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
git checkout
cd pipeline
```

2. Create a `.env` file with the following variables:
```
PGADMIN_DEFAULT_EMAIL=your_email@example.com
PGADMIN_DEFAULT_PASSWORD=your_password
MINIO_ACCESS_KEY_ID=your_access_key
MINIO_SECRET_ACCESS_KEY=your_secret_key
MINIO_ENDPOINT=minio:9000
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DATABASE=airflow
POSTGRES_SCHEMA=public
```

3. Start the services:
```bash
docker-compose up -d
```

### Accessing Services

- **Airflow**: http://localhost:8086
- **PgAdmin**: http://localhost:5050
- **MinIO**: http://localhost:9001
- **Spark Master**: http://localhost:8082
- **Spark Worker**: http://localhost:8081

## Development

### Adding New DAGs
Place new Airflow DAGs in the `airflow/dags` directory. The DAGs will be automatically loaded by Airflow.

### Database Changes
To modify the database schema:
1. Update `discountmate_schema.sql`
2. Apply changes through PgAdmin or direct SQL commands

## Future Plans

The project includes plans to migrate to Snowflake for enhanced data warehousing capabilities. The `snowflake_setup.md` file contains the configuration for this future transition.

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request

## License

[Add your license information here] 