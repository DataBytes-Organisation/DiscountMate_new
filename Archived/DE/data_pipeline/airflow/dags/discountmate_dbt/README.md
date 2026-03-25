# DiscountMate DBT Project

This repository contains the dbt (data build tool) project for DiscountMate, configured to work with PostgreSQL and utilizing Jinja templating.

## Version Control

### Files to Commit
The following files should be committed to version control as they contain project configuration and are essential for other developers:
- `dbt_project.yml` - Project configuration and settings
- `packages.yml` - dbt package dependencies
- All model files in `models/`
- All macro files in `macros/`
- All test files in `tests/`
- All seed files in `seeds/`
- All snapshot files in `snapshots/`

### Files to Ignore
The following files should NOT be committed to version control:
- `profiles.yml` - Contains database credentials (should be created locally)
- `target/` - Generated files
- `dbt_packages/` - Downloaded packages
- `logs/` - Log files
- Environment-specific files (`.env`, `.venv`, etc.)
- IDE-specific files (`.idea/`, `.vscode/`, etc.)

## Prerequisites

- Python 3.8 or higher
- dbt-core 1.5.0 or higher
- dbt-postgres adapter
- PostgreSQL 13 or higher
- Git
- Virtual environment (recommended)

## Set up

1. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dbt and PostgreSQL adapter:
```bash
pip install dbt-core dbt-postgres
```

3. Set up dbt Extensions

- Download the `power user for dbt`, `Jinja`, `Better Jinja` extension to ease interaction with dbt.

- Find `open user settings (json)` (can be accessed through Ctrl+Shift+P), then modify the json settings file to include:
```
"files.associations": {
    "*.sql": "jinja-sql",
    "*.yml": "yaml"
}
```

4. Clone this repository:
```bash
git clone <discountmate-repository-url>
cd DE/data_pipeline/discountmate_dbt
```

1. Create `profiles.yml`:
```yaml
discountmate_dbt:
  target: dev
  outputs:
    dev:
      type: postgres
      host: localhost
      port: 5432
      user: postgres
      password: postgres
      dbname: discountmate
      schema: marts
      threads: 1
```

1. Verify your connection:
```bash
dbt debug
```

1. Install project dependencies:
```bash
dbt deps
```

## Project Structure

```
discountmate_dbt/
├── analyses/       # Ad-hoc analyses
├── macros/        # Reusable Jinja macros
├── models/        # SQL models
│   ├── staging/   # Raw data transformations
│   ├── intermediate/ # Intermediate models
│   └── marts/     # Business-level models
├── seeds/         # Static data files
├── snapshots/     # Snapshot configurations
├── tests/         # Custom test definitions
├── profiles.yml   # Database connection (gitignored)
├── packages.yml   # dbt package dependencies
└── dbt_project.yml # Project configuration
```

## Development Workflow

1. **Branching Strategy**
   - Create feature branches from `main`
   - Use descriptive branch names
   - Keep branches focused on single features

2. **Making Changes**
   - Follow the existing model structure
   - Add tests for new models
   - Document your changes
   - Keep commits atomic and descriptive

3. **Model Development Guidelines**
   - Place models in appropriate directories:
     - `models/staging/` - Raw data transformations
     - `models/intermediate/` - Intermediate transformations
     - `models/marts/` - Business-level models
   - Use consistent naming conventions:
     - Staging models: `stg_*`
     - Intermediate models: `int_*`
     - Mart models: descriptive business names
   - Add documentation to all models:
     ```yaml
     version: 2
     models:
       - name: your_model
         description: "Description of what this model does"
         columns:
           - name: column_name
             description: "Description of the column"
     ```

4. **Testing Requirements**
   - Add tests for all new models
   - Include at least:
     - `unique` test for primary keys
     - `not_null` test for required fields
     - `relationships` test for foreign keys id

## Troubleshooting Common Issues

1. **Connection Problems**
   - Verify PostgreSQL is running
   - Check credentials in profiles.yml
   - Ensure database exists
   - Check network connectivity

2. **Model Failures**
   - Check logs in `logs/` directory
   - Verify SQL syntax
   - Check dependencies
   - Run `dbt debug` for configuration issues