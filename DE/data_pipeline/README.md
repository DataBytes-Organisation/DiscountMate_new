# DiscountMate Data Pipeline Setup Guide

## Table of Contents
- [DiscountMate Data Pipeline Setup Guide](#discountmate-data-pipeline-setup-guide)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Service Architecture](#service-architecture)
  - [Running the Services](#running-the-services)
  - [Accessing Services](#accessing-services)
  - [Data Verification](#data-verification)
  - [Data Pipeline Overview](#data-pipeline-overview)
  - [Customizing the Pipeline](#customizing-the-pipeline)
    - [Modifying Data Processing Logic](#modifying-data-processing-logic)
    - [Adding New Data Sources](#adding-new-data-sources)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues](#common-issues)
    - [Getting Help](#getting-help)
  - [Future Steps and Integrations](#future-steps-and-integrations)
    - [CI/CD Pipeline](#cicd-pipeline)
    - [Enhanced Testing Framework](#enhanced-testing-framework)
    - [Other Teams Integration](#other-teams-integration)

## Prerequisites

Before setting up the DiscountMate data pipeline, ensure you have the following installed:

- Docker and Docker Compose
- Python 3.8 or higher
- Git
- At least 4GB of RAM
- At least 2 CPU cores
- At least 10GB of free disk space

## Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/DataBytes-Organisation/DiscountMate_new.git
cd DE/data_pipeline
```

2. Create a `.env` file in the root directory with the following configuration:
```env
PGADMIN_DEFAULT_EMAIL=pgadmin@localhost.com
PGADMIN_DEFAULT_PASSWORD=pgadmin
MINIO_ACCESS_KEY_ID=minio
MINIO_SECRET_ACCESS_KEY=minio123
MINIO_ENDPOINT=minio:9000
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DATABASE=discountmate
POSTGRES_SCHEMA=landing
MONGO_URI=your_URI (ask mentor about this, or you can search online how to do so)
MONGO_DB=your_DB
```

## Service Architecture

The DiscountMate data pipeline consists of the following services:

1. **Airflow** (Port 8086)
   - Orchestrates the data pipeline
   - Manages DAGs and workflows
   - Handles scheduling and monitoring

2. **PostgreSQL** (Port 5432)
   - Primary database for storing application data
   - Contains the `discountmate` database with `landing` schema

3. **PgAdmin** (Port 5050)
   - Database administration interface
   - Monitor and manage PostgreSQL database

4. **MinIO** (Ports 9000, 9001)
   - Object storage for data files
   - Access via console at port 9001

5. **Spark** (Ports 8082, 7077)
   - Data processing engine
   - Master node accessible at port 8082
   - Worker nodes for distributed processing

6. **Metabase** (Port 3000)
   - Business intelligence and analytics platform
   - Visualize and analyze data

## Running the Services

1. Start all services:
```bash
docker compose up --build -d
```

2. Build the Spark application:
```bash
cd docker/spark-app
docker build -t spark-app .
```

## Accessing Services

1. **Airflow Web Interface**
   - URL: http://localhost:8086
   - Default credentials:
     - Username: airflow
     - Password: airflow

2. **PgAdmin**
   - URL: http://localhost:5050
   - Login with credentials from .env file
   - Add new server:
     - Host: postgres
     - Port: 5432
     - Database: discountmate
     - Username: postgres
     - Password: postgres

3. **MinIO Console**
   - URL: http://localhost:9001
   - Login with credentials from .env file

4. **Spark Master**
   - URL: http://localhost:8082

5. **Metabase**
   - URL: http://localhost:3000
   - Follow the setup wizard on first access

## Data Verification

After running the pipeline, verify the data in PgAdmin:

1. Open **PgAdmin** at http://localhost:5050
2. Log in using your credentials:
   ```
   Email: pgadmin@localhost.com  
   Password: pgadmin
   ```
3. In the PgAdmin interface:
   1. Right-click on **Servers** → **Create** → **Server**
   2. Under the **General** tab, name the server anything (e.g., `local`)
   3. Under the **Connection** tab, fill in the following:
      - **Host name/address**: `postgres`
      - **Port**: `5432`
      - **Username**: `postgres`
      - **Password**: `postgres`
   4. Click **Save**

4. Expand the server and connect to the `discountmate` database
5. Navigate to the `landing` schema
6. Run SQL queries to inspect the ingested and transformed data

## Data Pipeline Overview

The data pipeline is orchestrated through Airflow DAGs located in `airflow/dags/`. The main pipeline components are:

1. **Data Collection**
   - Sources data from various inputs
   - Stores raw data in MinIO

2. **Data Processing**
   - Spark jobs process the raw data
   - Transforms data according to business rules

3. **Data Storage**
   - Processed data is stored in PostgreSQL
   - Organized in the `landing` schema

4. **dbt Data Transformation**
   The data transformation follows a modular approach through different stages:
   
   a. **Landing Layer**
   - Raw data from source systems
   - Minimal transformations
   - Located in `landing` schema
   
   b. **Staging Layer**
   - Basic data cleaning and standardization
   - Type casting and renaming
   - Located in `staging` schema
   
   c. **Snapshot Layer**
   - Point-in-time snapshots of changing data
   - Historical tracking of changes
   - Located in `snapshot` schema
   
   d. **Intermediate Layer**
   - Complex transformations and aggregations
   - Business logic implementation
   - Located in `intermediate` schema
   
   e. **Marts Layer**
   - Final presentation layer
   - Business-specific aggregations
   - Located in `marts` schema

5. **Analytics**
   - Looker Studio is supposed to be primary BI tool.
   - Metabase provides visualization and analytics for quick demo
   - Access through the Metabase interface

## Customizing the Pipeline

### Modifying Data Processing Logic

1. **Airflow DAGs**
   - Location: `airflow/dags/`
   - Main DAG file: `discountmate.py`
   - Add new tasks or modify existing ones

2. **Spark Jobs**
   - Location: `docker/spark-app/`
   - Modify processing logic in Spark application
   - Rebuild the Spark image after changes

3. **Database Schema**
   - Location: `discountmate_schema.sql`
   - Modify database structure as needed
   - Apply changes through PgAdmin

4. **dbt Setup and Configuration**
   - Location: `airflow/dags/discountmate_dbt/`
   - For detailed dbt setup instructions, refer to [dbt README](airflow/dags/discountmate_dbt/README.md)
   - For running in Airflow, configure profiles.yml host to `host.docker.internal`
   - Key setup steps:
     ```bash
     # Install dbt and PostgreSQL adapter
     pip install dbt-core dbt-postgres
     
     # Create profiles.yml with database connection
     # See dbt README for configuration details
     
     # Install project dependencies
     cd airflow/dags/discountmate_dbt
     dbt deps
     
     # Verify connection
     dbt debug
     ```
   - Follow the development workflow and model guidelines in the dbt README

### Adding New Data Sources

1. Create a new data source connector in the appropriate DAG
2. Add data validation and transformation logic
3. Update the database schema if needed
4. Add new visualization in Metabase

## Troubleshooting

### Common Issues

1. **Service Not Starting**
   - Check Docker logs: `docker compose logs [service-name]`
   - Verify environment variables in .env file
   - Ensure ports are not in use

2. **Database Connection Issues**
   - Verify PostgreSQL is running: `docker compose ps postgres`
   - Check connection settings in PgAdmin
   - Verify database credentials
   - If local PostgreSQL is interfering:
     ```bash
     # Stop local PostgreSQL service
     brew services stop postgresql
     
     # Verify PostgreSQL is stopped
     brew services list
     
     # Restart Docker services
     docker compose down
     docker compose up --build -d
     ```

3. **Airflow DAG Failures**
   - Check Airflow logs in the web interface
   - Verify task dependencies
   - Check data source availability

4. **dbt Transformation Issues**
   - Check dbt logs in Airflow
   - Verify model dependencies in dbt project
   - Ensure proper schema permissions
   - Common fixes:
     ```bash
     # Rebuild dbt models
     cd airflow/dags/discountmate_dbt
     dbt clean
     dbt deps
     dbt run
     
     # Test specific models
     dbt test --models model_name
     ```

### Getting Help

- Check the logs of specific services:
```bash
docker compose logs [service-name]
```

- Restart specific services:
```bash
docker compose restart [service-name]
```

- Rebuild and restart all services:
```bash
docker compose down
docker compose up --build -d
```

## Future Steps and Integrations

### CI/CD Pipeline
- GitHub Actions workflow for automated testing and deployment
- Automated schema validation and data quality checks
- Automated dbt model testing and documentation generation
- Docker image versioning and automated builds
- Environment-specific deployments (dev, staging, prod)

### Enhanced Testing Framework
1. **Data Quality Tests**
   - Schema validation tests
   - Data completeness checks
   - Data accuracy validation
   - Data freshness monitoring
   - Custom data quality rules

2. **Integration Tests**
   - End-to-end pipeline testing
   - Service connectivity tests
   - Cross-service data flow verification

3. **Performance Tests**
   - Pipeline execution time benchmarks
   - Resource utilization monitoring
   - Query performance optimization
   - Load testing for concurrent operations

### Other Teams Integration
- Integration with web scraping team to have complete automatic pipeline.
- Discussion with other teams to have final DB schema. Then implement it by modifying the scripts.