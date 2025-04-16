# DiscountMate Data Engineering Pipeline

This repository contains the data engineering pipeline for DiscountMate, a platform that helps users find and track product discounts across different stores.

## Project Overview

DiscountMate is a data-driven application that helps users:
- Track product prices across different stores
- Create and manage shopping lists
- Monitor wishlists for price drops
- Find the best deals in their area

## Architecture

The project uses a modern data engineering stack with the following components:

### Core Components
- **Airflow**: Orchestration and workflow management
- **PostgreSQL**: Primary database for storing application data
- **MinIO**: Object storage for data files
- **Spark**: Data processing engine
- **PgAdmin**: Database administration tool

### Data Flow
1. Data is collected from various sources
2. Processed through Airflow DAGs
3. Stored in PostgreSQL database
4. Made available for analytics and reporting

## Project Structure

```
.
├── airflow/              # Airflow DAGs and configurations
├── docker/              # Docker configurations
├── include/             # Additional resources and data
├── .env                 # Environment variables
├── docker-compose.yml   # Docker services configuration
├── discountmate_schema.sql  # Database schema
└── snowflake_setup.md   # Future Snowflake configuration
```

## Setup Instructions

### Prerequisites
- Docker and Docker Compose
- Python 3.8+
- Git

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/DataBytes-Organisation/DiscountMate_new.git
cd DE/data_pipeline
```

2. Create a `.env` file with the following variables:
```
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
```

3. Start the services:
```bash
# Based on your docker version, the syntax may be different, please try the second syntax
# if the first syntax cannot run

docker compose up --build -d

or

docker-compose up --build -d
```

then

```bash
cd docker/spark-app

docker build -t spark-app .
```

### Accessing Services

- **Airflow**: http://localhost:8086
- **PgAdmin**: http://localhost:5050
- **MinIO**: http://localhost:9001
- **Spark Master**: http://localhost:8082

## Running the Pipeline

Once all services are up and running, you can trigger the data pipeline as follows:

1. **Access Airflow**  
Open the browser and navigate to [http://localhost:8086](http://localhost:8086). Use the default credentials if prompted: 
    ```
    Username: airflow
    Password: airflow
    ```

1. **Trigger a DAG**  
- Navigate to the DAGs page.
- Locate the DAG corresponding to data pipeline (pipeline)
- Toggle it **On** and click the **Play** (▶) button to trigger a manual run.

1. **Monitor DAG Run**  
Use the **Graph View** or **Tree View** in Airflow to monitor the status of tasks within the DAG. Check logs for detailed output or error messages.

1. **Data Verification**  
Once the DAG finishes running:
- Open **PgAdmin** at [http://localhost:5050](http://localhost:5050)
- Log in using your credentials:
    ```
    Email: pgadmin@localhost.com  
    Password: pgadmin
    ```
- In the PgAdmin interface:
    1. Right-click on **Servers** → **Create** → **Server**
    2. Under the **General** tab, name the server anything (e.g., `local`)
    3. Under the **Connection** tab, fill in the following:
        - **Host name/address**: `postgres`
        - **Port**: `5432`
        - **Username**: `postgres`
        - **Password**: `postgres`
     . Click **Save**

- Expand the server and connect to the `discountmate` database
- Navigate to the `landing` schema
- Run SQL queries to inspect the ingested and transformed data.