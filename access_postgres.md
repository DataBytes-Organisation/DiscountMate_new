# Accessing PostgreSQL - Quick Reference

## Current Setup Status ✅

- **Database**: `discountmate` (created and initialized)
- **Container**: `app_db` (PostgreSQL 16) - Running on port 5432
- **Tables Created**: 6 tables (user, store, product, product_pricing, wish, wishlist)
- **pgAdmin**: Available at http://localhost:5050
- **Environment**: `.env` file created in `DE/data_pipeline/`

## Quick Access Methods

### Option A: Using Docker exec (Recommended for WSL)
```bash
# Connect to PostgreSQL from WSL
docker exec -it app_db psql -U postgres -d discountmate

# List all tables
docker exec app_db psql -U postgres -d discountmate -c "\dt"

# View table structure
docker exec app_db psql -U postgres -d discountmate -c "\d product"
```

### Option B: Using pgAdmin (Web UI) 🌐
1. **Open browser**: http://localhost:5050
2. **Login credentials**:
   - Email: `pgadmin@localhost.com`
   - Password: `pgadmin`
3. **Add Server**:
   - Right-click "Servers" → "Create" → "Server"
   - **General tab**: Name it (e.g., "DiscountMate App DB")
   - **Connection tab**:
     - Host name/address: `app_db` (use this from inside Docker network)
     - Port: `5432`
     - Maintenance database: `discountmate`
     - Username: `postgres`
     - Password: `password`
     - ✅ Check "Save password"
   - Click "Save"

**Note**: If `app_db` doesn't work, try `host.docker.internal` or `localhost`

### Option C: Direct Connection (from host machine)
From any PostgreSQL client (DBeaver, TablePlus, psql, etc.):
- **Host**: `localhost`
- **Port**: `5432`
- **Username**: `postgres`
- **Password**: `password`
- **Database**: `discountmate`

## Connection Strings

### Main Application Database (app_db)
```
postgresql://postgres:password@localhost:5432/discountmate
```

### Data Pipeline Database (if running)
```
postgresql://postgres:postgres@localhost:5432/discountmate
```

## Database Tables

The following tables were created by `db_init`:

1. **user** - User accounts and profiles
2. **store** - Store information and locations
3. **product** - Product catalog
4. **product_pricing** - Historical pricing data
5. **wish** - Wish items
6. **wishlist** - User wishlists

**Note**: The SQL schema also defines `basket`, `shopping_list_item`, and `shopping_list` tables, but these were not created by the Python script.

## Starting/Managing Containers

### Start the main app database:
```bash
cd DE
docker-compose up -d postgres
```

### Initialize database tables (run once):
```bash
cd DE
docker-compose up db_init
```

### Start pgAdmin:
```bash
cd DE/data_pipeline
docker-compose up -d pgadmin
```

### Check container status:
```bash
docker ps | grep -E "app_db|pgadmin"
```

## Installing psql in WSL (Alternative)

If you want to use psql directly in WSL:

```bash
# For Ubuntu/Debian
sudo apt update
sudo apt install postgresql-client

# Then connect
psql -h localhost -p 5432 -U postgres -d discountmate
# Password: password
```

## Troubleshooting

### pgAdmin can't connect?
- Make sure pgAdmin is on the same Docker network: `docker network connect de_openfga pgadmin`
- Use `app_db` as hostname (not `localhost`) when connecting from pgAdmin container
- Verify container is running: `docker ps | grep app_db`

### Port already in use?
- Only one PostgreSQL container can use port 5432 at a time
- Stop the other one: `docker stop postgres` or `docker stop app_db`

### Missing tables?
- Run `db_init` to create tables: `cd DE && docker-compose up db_init`
- Or manually create from SQL: `docker exec -i app_db psql -U postgres -d discountmate < DE/data_pipeline/discountmate_schema.sql`

