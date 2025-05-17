# IGA Grocery Data Cleaning Tool

This Python-based data cleaning program processes a grocery dataset from IGA to prepare it for analysis. The code performs multiple tasks to improve data quality and structure, making it suitable for downstream tasks such as pricing models, discount trend analysis, and visual reporting.

### What the code does:
- Extracts unit-based prices (e.g., "$2 per 100g") into separate numeric and unit columns.
- Handles missing values using category-level median and mode imputation for both prices and unit types.
- Cleans original price columns by removing symbols and text for numeric analysis.
- Generates KDE plots to visually compare price distributions before and after imputation.
- Detects and reports outliers using the IQR method, including top high-value anomalies.
- Encodes categorical columns such as product category and unit type using frequency and one-hot encoding.
- Outputs a cleaned, analysis-ready dataset as a CSV file.

The tool is structured to maintain distribution integrity, identify unusual pricing behavior, and prepare reliable features for modeling or data exploration.
