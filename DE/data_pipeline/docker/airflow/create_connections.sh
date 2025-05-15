#!/bin/bash

# MinIO Connection
airflow connections add 'minio' \
    --conn-type 'aws' \
    --conn-login 'minio' \
    --conn-password 'minio123' \
    --conn-extra '{"endpoint_url": "http://host.docker.internal:9000"}'

# Postgres Connection
airflow connections add 'postgres' \
    --conn-type 'postgres' \
    --conn-host 'postgres' \
    --conn-schema 'postgres' \
    --conn-login 'postgres' \
    --conn-password 'postgres' \
    --conn-port '5432'

echo "Connections added successfully."
