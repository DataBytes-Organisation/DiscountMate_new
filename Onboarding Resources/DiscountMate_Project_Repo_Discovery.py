import os
import re
import json
import subprocess
import pandas as pd
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter
import warnings
warnings.filterwarnings('ignore')

class RepositoryDiscoveryTool:
    """
    Consolidated Analysis System - Version 5.0
    Optimized for large repositories with directory pruning and enhanced Git metadata.
    """
    
    def __init__(self, root_path, script_dir):
        self.root_path = Path(root_path).resolve()
        self.script_dir = Path(script_dir).resolve()
        self.results = {
            'code_files': [],
            'datasets': [],
            'usage_links': []
        }
        
        # 1. Foundational Exclusions
        self.exclude_dirs = {
            '.venv', 'venv', 'env', 'node_modules', '__pycache__',
            '.git', '.pytest_cache', 'site-packages', 'Lib', 'Documentation',
            'Onboarding Resources'
        }
        
        # 2. Load custom ignore from Onboarding Resources/.discovery_ignore
        self._load_discovery_ignore()
        
        # File extensions (Matching Original v4.1)
        self.code_extensions = {
            '.py': 'Python', '.ipynb': 'Jupyter Notebook', '.js': 'JavaScript',
            '.ts': 'TypeScript', '.jsx': 'React JSX', '.tsx': 'React TSX',
            '.sql': 'SQL', '.R': 'R'
        }
        
        self.data_extensions = {
            '.csv': 'CSV', '.xlsx': 'Excel', '.xls': 'Excel',
            '.json': 'JSON', '.parquet': 'Parquet', '.db': 'SQLite', '.sqlite': 'SQLite'
        }
        
        # Purpose patterns (Matching Original v4.1)
        self.purpose_patterns = {
            'Machine Learning': ['sklearn', 'xgboost', 'lightgbm', 'catboost', 'model', 'train', 'predict'],
            'Deep Learning': ['tensorflow', 'keras', 'torch', 'pytorch', 'neural', 'lstm', 'cnn'],
            'Data Analysis': ['pandas', 'numpy', 'describe', 'info', 'head', 'eda', 'analysis'],
            'Visualization': ['matplotlib', 'seaborn', 'plotly', 'bokeh', 'plot', 'chart', 'graph'],
            'Web Scraping': ['beautifulsoup', 'bs4', 'selenium', 'scrapy', 'requests', 'scrape'],
            'API/Backend': ['flask', 'django', 'fastapi', 'express', 'api', 'endpoint', 'route'],
            'Frontend': ['react', 'vue', 'angular', 'component', 'state', 'props'],
            'Database': ['sqlalchemy', 'pymongo', 'psycopg2', 'mysql', 'sqlite3', 'database', 'query'],
            'Data Engineering': ['airflow', 'etl', 'pipeline', 'transform', 'load', 'extract'],
            'Testing': ['pytest', 'unittest', 'test', 'mock', 'fixture']
        }

    def _load_discovery_ignore(self):
        ignore_file = self.script_dir / '.discovery_ignore'
        if ignore_file.exists():
            print(f"Applying custom exclusions from: {ignore_file}")
            with open(ignore_file, 'r') as f:
                for line in f:
                    clean = line.strip().rstrip('/')
                    if clean and not clean.startswith('#'):
                        self.exclude_dirs.add(clean)

    def get_git_metadata(self, file_path):
        """Retrieves Original and Last Author/Date metadata"""
        meta = {"orig": "N/A", "last": "N/A"}
        try:
            # Last Commit info
            l_res = subprocess.run(['git', 'log', '-1', '--format=%as by %an', '--', str(file_path)], 
                                  capture_output=True, text=True, cwd=self.root_path, timeout=5)
            if l_res.returncode == 0: meta["last"] = l_res.stdout.strip()

            # Original Commit info (using --follow for renames)
            o_res = subprocess.run(['git', 'log', '--follow', '--format=%as by %an', '--', str(file_path)], 
                                  capture_output=True, text=True, cwd=self.root_path, timeout=5)
            if o_res.returncode == 0:
                history = o_res.stdout.strip().split('\n')
                meta["orig"] = history[-1]
        except: pass
        return meta

    def run_optimized_scan(self):
        """Walks repository and prunes excluded directories BEFORE scanning files"""
        print(f"\nFAST-SCANNING REPOSITORY: {self.root_path}")
        print("=" * 80)
        
        for root, dirs, files in os.walk(self.root_path):
            # PRUNING: Skips heavy folders like 'catalogues' instantly
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]
            
            for file in files:
                f_path = Path(root) / file
                ext = f_path.suffix.lower()
                
                if ext in self.code_extensions:
                    self._process_code_file(f_path)
                elif ext in self.data_extensions:
                    self._process_data_file(f_path)

    def _process_code_file(self, file_path):
        try:
            rel_path = file_path.relative_to(self.root_path)
            ext = file_path.suffix
            content = self.extract_notebook_content(file_path) if ext == '.ipynb' else self.read_file_safe(file_path)
            imports = self.extract_imports(content, ext)
            git = self.get_git_metadata(file_path)
            
            self.results['code_files'].append({
                'filename': file_path.name,
                'path': str(rel_path),
                'category': self.categorize_by_directory(rel_path),
                'type': self.code_extensions[ext],
                'size_kb': round(file_path.stat().st_size / 1024, 2),
                'git_orig': git['orig'],
                'git_last': git['last'],
                'imports': ', '.join(sorted(imports)[:15]),
                'purposes': ', '.join(self.infer_purpose(content, imports)),
                'num_imports': len(imports),
                'lines': content.count('\n') + 1 if content else 0,
                'content': content
            })
        except: pass

    def _process_data_file(self, file_path):
        try:
            rel_path = file_path.relative_to(self.root_path)
            git = self.get_git_metadata(file_path)
            result = {
                'filename': file_path.name,
                'path': str(rel_path),
                'category': self.categorize_by_directory(rel_path),
                'type': self.data_extensions[file_path.suffix],
                'size_mb': round(file_path.stat().st_size / (1024 * 1024), 2),
                'git_last': git['last'],
                'rows': None, 'columns': None, 'column_names': []
            }
            if file_path.suffix == '.csv':
                df = self.load_csv(file_path)
                if df is not None: result.update(self.analyze_dataframe(df))
            elif file_path.suffix in ['.xlsx', '.xls']:
                result.update(self.analyze_excel(file_path))
            
            self.results['datasets'].append(result)
        except: pass

    # --- REPLACED SCAN LOGIC COMPLETED ---
    # --- RESTORING ORIGINAL v4.1 HELPERS AND REPORTS ---

    def categorize_by_directory(self, rel_path):
        parts = Path(rel_path).parts
        if len(parts) == 1: return "Root"
        root_dir = parts[0]
        category_map = {
            'Backend': 'Backend', 'Frontend': 'Frontend', 'ML': 'Machine Learning',
            'Data': 'Data', 'Data Analysis': 'Data Analysis', 'Scrapping': 'Web Scraping',
            'DE': 'Data Engineering', 'KNN': 'Machine Learning', 'Onboarding Test': 'Onboarding'
        }
        return category_map.get(root_dir, root_dir)

    def extract_imports(self, content, file_ext):
        imports = set()
        if file_ext in ['.py', '.ipynb']:
            patterns = [r'^import\s+(\w+)', r'^from\s+(\w+)\s+import']
            for line in content.split('\n'):
                for p in patterns:
                    match = re.match(p, line.strip())
                    if match: imports.add(match.group(1).split('.')[0])
        return list(imports)

    def infer_purpose(self, content, imports):
        purposes = set()
        content_lower = content.lower()
        for cat, kws in self.purpose_patterns.items():
            if any(kw.lower() in imp.lower() for imp in imports for kw in kws) or \
               any(kw in content_lower for kw in kws):
                purposes.add(cat)
        return list(purposes) if purposes else ['General']

    def read_file_safe(self, file_path):
        for enc in ['utf-8', 'latin-1', 'cp1252']:
            try:
                with open(file_path, 'r', encoding=enc) as f: return f.read()
            except: continue
        return ""

    def extract_notebook_content(self, file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                nb = json.load(f)
            return '\n'.join([''.join(c.get('source', [])) for c in nb.get('cells', []) if c.get('cell_type') == 'code'])
        except: return ""

    def load_csv(self, file_path):
        try: return pd.read_csv(file_path, encoding='utf-8', nrows=5000)
        except:
            try: return pd.read_csv(file_path, encoding='latin-1', nrows=5000)
            except: return None

    def analyze_excel(self, file_path):
        try:
            df = pd.read_excel(file_path, sheet_name=0, nrows=5000)
            return self.analyze_dataframe(df)
        except: return {'error': 'Could not read Excel'}

    def analyze_dataframe(self, df):
        return {
            'rows': len(df), 'columns': len(df.columns),
            'column_names': list(df.columns),
            'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()}
        }

    def link_code_to_datasets(self):
        print("\nLINKING CODE FILES TO DATASETS...")
        dataset_names = [d['filename'] for d in self.results['datasets']]
        for code_file in self.results['code_files']:
            content = code_file.get('content', '')
            if content:
                content_lower = content.lower()
                for d_name in dataset_names:
                    d_base = Path(d_name).stem.lower()
                    if len(d_base) > 3 and d_base in content_lower:
                        self.results['usage_links'].append({
                            'code_file': code_file['filename'], 'code_path': code_file['path'],
                            'code_type': code_file['type'], 'code_purposes': code_file['purposes'],
                            'dataset_name': d_name,
                            'dataset_path': next((d['path'] for d in self.results['datasets'] if d['filename'] == d_name), '')
                        })
            code_file.pop('content', None) # Free memory

    # --- REPORT GENERATION (Original v4.1 Format) ---
    def generate_report_1(self):
        """REPORT 1: Code File Inventory with Purpose Inference"""
        print("\nGENERATING REPORT 1: CODE INVENTORY")
        print("=" * 80)
        
        df = pd.DataFrame(self.results['code_files'])
        by_category = df.groupby('category')
        
        report = []
        report.append("REPORT 1: CODE FILE INVENTORY")
        report.append("=" * 80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Total Code Files: {len(df)}")
        report.append("")
        
        # Summary statistics
        report.append("SUMMARY BY FILE TYPE")
        report.append("-" * 80)
        type_summary = df.groupby('type').agg({
            'filename': 'count',
            'lines': 'sum',
            'size_kb': 'sum'
        }).sort_values('filename', ascending=False)
        
        for file_type, row in type_summary.iterrows():
            report.append(f"{file_type:20} | Files: {int(row['filename']):4} | "
                        f"Lines: {int(row['lines']):8,} | Size: {row['size_kb']:8,.1f} KB")
        
        report.append("")
        report.append("SUMMARY BY PURPOSE")
        report.append("-" * 80)
        
        # Count purposes
        purpose_counts = Counter()
        for purposes_str in df['purposes']:
            for purpose in str(purposes_str).split(', '):
                purpose_counts[purpose.strip()] += 1
        
        for purpose, count in purpose_counts.most_common(15):
            report.append(f"{purpose:30} | {count:4} files")
        
        report.append("")
        report.append("")
        report.append("DETAILED FILE LISTING BY CATEGORY")
        report.append("=" * 80)
        
        for category, group in by_category:
            report.append(f"\nCATEGORY: {category} ({len(group)} files)")
            report.append("-" * 80)
            
            for _, row in group.sort_values('filename').iterrows():
                report.append(f"\n{row['filename']}")
                report.append(f"  Path: {row['path']}")
                report.append(f"  Type: {row['type']:20} | Lines: {int(row['lines']):6,} | "
                            f"Size: {row['size_kb']:7,.1f} KB")
                report.append(f"  Created: {row['git_orig']}")
                report.append(f"  Latest:  {row['git_last']}")
                if row['purposes']:
                    report.append(f"  Purpose: {row['purposes']}")
                if row['imports']:
                    imports_short = row['imports'][:100] + '...' if len(row['imports']) > 100 else row['imports']
                    report.append(f"  Key Imports: {imports_short}")
        
        # Save TXT report
        output_txt = self.script_dir / 'REPORT_1_CODE_INVENTORY.txt'
        with open(output_txt, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report))
        
        # Save CSV export
        df_export = df[['category', 'filename', 'path', 'type', 'lines', 'size_kb', 
                        'git_orig', 'git_last', 'purposes', 'imports', 'num_imports']].copy()
        df_export.columns = ['Category', 'Filename', 'Path', 'Type', 'Lines', 'Size_KB', 
                            'Created_By', 'Last_Modified_By', 'Purpose', 'Key_Imports', 'Num_Imports']
        csv_path = self.script_dir / 'REPORT_1_CODE_INVENTORY.csv'
        df_export.to_csv(csv_path, index=False, encoding='utf-8')
        
        print(f"Saved: REPORT_1_CODE_INVENTORY.txt")
        print(f"Saved: REPORT_1_CODE_INVENTORY.csv")
        return output_txt

    def generate_report_2(self):
        """REPORT 2: Dataset Catalog with Schema Information"""
        print("\nGENERATING REPORT 2: DATASET CATALOG")
        print("=" * 80)
        
        df = pd.DataFrame(self.results['datasets'])
        
        report = []
        report.append("REPORT 2: DATASET CATALOG")
        report.append("=" * 80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Total Datasets: {len(df)}")
        report.append("")
        
        # Summary statistics
        report.append("SUMMARY BY TYPE")
        report.append("-" * 80)
        type_summary = df.groupby('type').agg({
            'filename': 'count',
            'size_mb': 'sum',
            'rows': 'sum'
        }).sort_values('filename', ascending=False)
        
        for file_type, row in type_summary.iterrows():
            rows_total = int(row['rows']) if pd.notna(row['rows']) else 0
            report.append(f"{file_type:10} | Files: {int(row['filename']):4} | "
                        f"Total Rows: {rows_total:12,} | Size: {row['size_mb']:8,.1f} MB")
        
        report.append("")
        report.append("SUMMARY BY CATEGORY")
        report.append("-" * 80)
        cat_summary = df.groupby('category').agg({
            'filename': 'count',
            'size_mb': 'sum'
        }).sort_values('filename', ascending=False)
        
        for category, row in cat_summary.iterrows():
            report.append(f"{category:30} | Files: {int(row['filename']):4} | "
                        f"Size: {row['size_mb']:8,.1f} MB")
        
        report.append("")
        report.append("")
        report.append("DETAILED DATASET LISTING")
        report.append("=" * 80)
        
        # Group by category
        by_category = df.groupby('category')
        
        for category, group in by_category:
            report.append(f"\nCATEGORY: {category}")
            report.append("-" * 80)
            
            for _, row in group.sort_values('filename').iterrows():
                report.append(f"\n{row['filename']}")
                report.append(f"  Path: {row['path']}")
                report.append(f"  Type: {row['type']:10} | Size: {row['size_mb']:7,.1f} MB")
                report.append(f"  Latest Commit: {row['git_last']}")
                if pd.notna(row['rows']) and pd.notna(row['columns']) and row['rows'] and row['columns']:
                    report.append(f"  Dimensions: {int(row['rows']):,} rows x {int(row['columns'])} columns")
                    
                    if row['column_names']:
                        report.append(f"  Columns ({len(row['column_names'])}):") 
                        for i, col in enumerate(row['column_names'][:20], 1):
                            dtype = row.get('dtypes', {}).get(col, 'unknown')
                            report.append(f"    {i:2}. {col:40} ({dtype})")
                        
                        if len(row['column_names']) > 20:
                            report.append(f"    ... and {len(row['column_names']) - 20} more columns")
        
        # Save TXT report
        output_txt = self.script_dir / 'REPORT_2_DATASET_CATALOG.txt'
        with open(output_txt, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report))
        
        # Save CSV export (with schema as string)
        df_export = df.copy()
        df_export['schema'] = df_export.apply(lambda row: 
            json.dumps({'columns': row['column_names'], 'dtypes': row.get('dtypes', {})}) 
            if row['column_names'] else '', axis=1)
        
        df_export = df_export[['category', 'filename', 'path', 'type', 'size_mb', 
                               'rows', 'columns', 'git_last', 'schema']]
        df_export.columns = ['Category', 'Filename', 'Path', 'Type', 'Size_MB', 
                            'Rows', 'Columns', 'Last_Modified_By', 'Schema']
        
        csv_path = self.script_dir / 'REPORT_2_DATASET_CATALOG.csv'
        df_export.to_csv(csv_path, index=False, encoding='utf-8')
        
        print(f"Saved: REPORT_2_DATASET_CATALOG.txt")
        print(f"Saved: REPORT_2_DATASET_CATALOG.csv")
        return output_txt

    def generate_report_3(self):
        """REPORT 3: Code-to-Dataset Usage Matrix"""
        print("\nGENERATING REPORT 3: USAGE MATRIX")
        print("=" * 80)
        
        if not self.results['usage_links']:
            print("No usage links found, skipping report 3")
            return None
        
        df = pd.DataFrame(self.results['usage_links'])
        
        report = []
        report.append("REPORT 3: CODE-TO-DATASET USAGE MATRIX")
        report.append("=" * 80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Total Usage Links: {len(df)}")
        report.append("")
        
        # Top datasets by usage
        report.append("TOP 20 MOST REFERENCED DATASETS")
        report.append("-" * 80)
        top_datasets = df['dataset_name'].value_counts().head(20)
        
        for i, (dataset, count) in enumerate(top_datasets.items(), 1):
            files_list = df[df['dataset_name'] == dataset]['code_file'].unique()
            files_preview = ', '.join(files_list[:3])
            if len(files_list) > 3:
                files_preview += f', ... (+{len(files_list) - 3} more)'
            
            report.append(f"{i:2}. {dataset:50} | Used by {count:3} files")
            report.append(f"    Files: {files_preview}")
        
        report.append("")
        report.append("")
        report.append("TOP 20 FILES USING MOST DATASETS")
        report.append("-" * 80)
        top_files = df.groupby(['code_file', 'code_type', 'code_purposes']).agg({
            'dataset_name': lambda x: list(x.unique())
        }).reset_index()
        top_files['num_datasets'] = top_files['dataset_name'].apply(len)
        top_files = top_files.sort_values('num_datasets', ascending=False).head(20)
        
        for i, row in enumerate(top_files.itertuples(), 1):
            report.append(f"{i:2}. {row.code_file:50}")
            report.append(f"    Type: {row.code_type:20} | Purpose: {row.code_purposes}")
            report.append(f"    Uses {row.num_datasets} datasets: {', '.join(row.dataset_name[:5])}")
            if len(row.dataset_name) > 5:
                report.append(f"    ... and {len(row.dataset_name) - 5} more")
        
        report.append("")
        report.append("")
        report.append("COMPLETE USAGE MATRIX")
        report.append("=" * 80)
        
        # Group by dataset
        by_dataset = df.groupby('dataset_name')
        
        for dataset_name, group in by_dataset:
            report.append(f"\nDATASET: {dataset_name}")
            report.append(f"  Path: {group.iloc[0]['dataset_path']}")
            report.append(f"  Referenced by {len(group)} code files:")
            report.append("")
            
            for _, row in group.sort_values('code_file').iterrows():
                report.append(f"  - {row['code_file']:40} ({row['code_type']})")
                if row['code_purposes']:
                    report.append(f"    Purpose: {row['code_purposes']}")
        
        # Save TXT report
        output_txt = self.script_dir / 'REPORT_3_USAGE_MATRIX.txt'
        with open(output_txt, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report))
        
        # Save CSV export
        df_export = df[['dataset_name', 'dataset_path', 'code_file', 'code_path', 
                        'code_type', 'code_purposes']]
        df_export.columns = ['Dataset_Name', 'Dataset_Path', 'Code_File', 'Code_Path', 
                            'Code_Type', 'Code_Purpose']
        csv_path = self.script_dir / 'REPORT_3_USAGE_MATRIX.csv'
        df_export.to_csv(csv_path, index=False, encoding='utf-8')
        
        print(f"Saved: REPORT_3_USAGE_MATRIX.txt")
        print(f"Saved: REPORT_3_USAGE_MATRIX.csv")
        return output_txt

def main():
    script_dir = Path(__file__).parent.resolve()
    root_path = script_dir.parent if script_dir.name == "Onboarding Resources" else script_dir
    
    print("\n" + "="*80 + "\nREPOSITORY DISCOVERY TOOL v5.0 (Optimized)\n" + "="*80)
    print("\nPlease select which reports to generate:")
    print("  1. Report 1 only - Code Inventory")
    print("  2. Report 2 only - Dataset Catalog")
    print("  3. Report 3 only - Usage Matrix")
    print("  4. Reports 1 & 2 - Core Documentation")
    print("  5. All Reports (1, 2, 3)")
    print("\n  0. Exit")

    choice = input("\nEnter choice (0-5): ").strip()
    if choice == '0': return

    tool = RepositoryDiscoveryTool(root_path, script_dir)
    tool.run_optimized_scan()
    
    if choice in ['3', '5']:
        tool.link_code_to_datasets()
    
    print("\n" + "="*80 + "\nGENERATING SELECTED REPORTS\n" + "="*80)
    if choice in ['1', '4', '5']: tool.generate_report_1()
    if choice in ['2', '4', '5']: tool.generate_report_2()
    if choice in ['3', '5']: tool.generate_report_3()
    
    print("\nCOMPLETE. Reports are located in: " + str(script_dir))

if __name__ == "__main__":
    main()