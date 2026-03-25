# Data Engineering Architecture


### Detailed Overview of the DE Folder Structure

#### 1. **Folder Descriptions**

- **db_init Folder**
  This folder is responsible for setting up the PostgreSQL database and initializing its tables. It contains scripts and configuration files for creating the required tables with Docker.

   - **Dockerfile:** Defines a Docker environment using Python 3.9 to interact with PostgreSQL. It installs the necessary dependencies, including `psycopg2` for PostgreSQL connectivity and `sqlalchemy` for database modeling.
   
   - **create_table.py:** This Python script connects to the PostgreSQL instance and creates the required database and tables. It uses SQLAlchemy to define table schemas (e.g., `user`, `product`, `store`, etc.) and initializes them in the PostgreSQL database.
   
   - **requirements.txt:** Lists all necessary Python packages such as `psycopg2` and `sqlalchemy` to enable database connections and table creation.

- **db_sample_create Folder**
  This folder is used to inject sample data into the PostgreSQL database from an external MongoDB source.

   - **Dockerfile:** Similar to the `db_init` Dockerfile, this script creates a Python environment for handling the data injection process.
   
   - **create_sample_product.py:** The main script for data injection. It connects to a MongoDB instance, retrieves product data, and uses `pandas` to manipulate the data before inserting it into the PostgreSQL `product` table.
   
   - **requirements.txt:** Contains additional dependencies such as `pymongo` for interacting with MongoDB and `pandas` for data manipulation.

- **postgres_config Folder**
  This folder holds PostgreSQL configuration files, allowing you to customize how the PostgreSQL database operates.

   - **postgres.conf:** Configures PostgreSQL with specific settings for replication and connection accessibility. This includes parameters such as `wal_level` for replication, the number of replication slots, and the network connection settings.

#### 2. **Key Configuration Files**

- **docker-compose.yaml**
  This YAML file orchestrates the setup and deployment of Docker containers for PostgreSQL and other services, such as MongoDB. It defines the services, networking, volumes, and ports needed to run the entire system locally.

- **README.md**
  The README file provides an overview of the project, explaining how to use the DE folder. It also outlines the dependencies and the steps required to initialize the PostgreSQL database, inject sample data, and manage the Docker environment.

#### 3. **Usage Instructions**

To properly set up and use the DE folder:

1. **Step 1: Initialize the PostgreSQL Database**
   - Navigate to the `db_init` folder and run the `Dockerfile` to set up the environment.
   - Once the Docker container is up, execute the `create_table.py` script to create the necessary tables in PostgreSQL.
   
   ```bash
   docker-compose up db_init
   ```

2. **Step 2: Inject Sample Data**
   - After setting up the database, navigate to the `db_sample_create` folder.
   - Run the `Dockerfile` in this folder to set up the environment for sample data injection.
   - Execute the `create_sample_product.py` script, which will connect to MongoDB, retrieve sample data, and populate the PostgreSQL `product` table.
   
   ```bash
   docker-compose up db_sample_create
   ```

3. **Step 3: Configuration and Execution**
   - Ensure the PostgreSQL database is properly configured using the `postgres_config/postgres.conf` file. This step is essential for enabling features like replication and ensuring proper network access.
   - Use the `docker-compose.yaml` to manage the overall environment and launch both the PostgreSQL and MongoDB containers as needed.
   
   ```bash
   docker-compose up
   ```

By following these steps, users will be able to fully set up and use the PostgreSQL database, create necessary tables, and inject sample data from MongoDB. The `README.md` file provides additional details and troubleshooting instructions.
