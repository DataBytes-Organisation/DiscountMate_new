-- Create database if it doesn't exist
SELECT 'CREATE DATABASE discountmate'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'discountmate')\gexec

-- Create the `airflow` role with login and superuser privileges
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'airflow') THEN
        CREATE ROLE airflow WITH LOGIN PASSWORD 'airflow';
        ALTER ROLE airflow CREATEDB;
        ALTER ROLE airflow CREATEROLE;
        ALTER ROLE airflow SUPERUSER;
        GRANT ALL PRIVILEGES ON DATABASE discountmate TO airflow;
    ELSE
        RAISE NOTICE 'Role airflow already exists.';
    END IF;
END $$;

-- Connect to the `discountmate` database
\c discountmate

-- Create the `landing` schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS landing;
SET search_path TO landing;

-- Create the `transform` role if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'transform') THEN
        CREATE ROLE transform WITH SUPERUSER;
    ELSE
        RAISE NOTICE 'Role transform already exists.';
    END IF;
END $$;

-- Create the `dbt` user and assign to `transform` role
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dbt') THEN
        CREATE ROLE dbt WITH LOGIN PASSWORD 'dbtPassword123';
        GRANT transform TO dbt;
    ELSE
        RAISE NOTICE 'Role dbt already exists.';
    END IF;
END $$;

-- Create the `marts` schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS marts;

-- Create the `reporter` role if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reporter') THEN
        CREATE ROLE reporter;
    ELSE
        RAISE NOTICE 'Role reporter already exists.';
    END IF;
END $$;

-- Assign permissions to `reporter` role for `marts` schema
GRANT USAGE ON SCHEMA marts TO reporter;
GRANT SELECT ON ALL TABLES IN SCHEMA marts TO reporter;
ALTER DEFAULT PRIVILEGES IN SCHEMA marts GRANT SELECT ON TABLES TO reporter;

-- Create the `pbi` user and assign to `reporter` role
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pbi') THEN
        CREATE USER pbi WITH PASSWORD 'pbiPassword123';
        GRANT reporter TO pbi;
        ALTER ROLE pbi INHERIT;
    ELSE
        RAISE NOTICE 'User pbi already exists.';
    END IF;
END $$;