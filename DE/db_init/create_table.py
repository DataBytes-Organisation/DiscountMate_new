import psycopg2
from psycopg2 import sql
from sqlalchemy import create_engine, Column, Integer, String, Date, DECIMAL, ForeignKey, text
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote
import time

def connect_and_create(max_retries=5, delay=5):
    retries = 0
    while retries < max_retries:
        try:
            conn = psycopg2.connect(
                dbname="postgres",
                user="postgres",
                password="password",
                host="postgres",
                port="5432"
            )
            
            cur = conn.cursor()
            cur.execute("SELECT version();")
            db_version = cur.fetchone()
            
            print("Successfully connected to PostgreSQL.")
            print(f"PostgreSQL version: {db_version[0]}")
            
            cur.close()
            conn.close()
            return
            
        except OperationalError as e:
            print(f"Attempt {retries + 1} failed: {e}")
            retries += 1
            time.sleep(delay)
    
    print("Failed to connect to PostgreSQL after multiple attempts.")

def create_database(db_password="password",db_user="postgres",db_host="postgres"):

    conn = psycopg2.connect(
                dbname="postgres",
                user=db_user,
                password=db_password,
                host=db_host,
                port="5432"
            )
    
    # Enable autocommit mode
    conn.autocommit = True

    # Create a cursor object
    cur = conn.cursor()

    # Define the database name
    db_name = 'discountmate'
    try:
        # Create the 'discountmate' database if it does not exist
        cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
        print(f"Database '{db_name}' created successfully.")
    except psycopg2.errors.DuplicateDatabase:
        print(f"Database '{db_name}' already exists.")
        
    # Close the cursor and connection
    cur.close()
    conn.close()

    # Create a base class
    Base = declarative_base()

    class User(Base):
        __tablename__ = 'user'
        user_id = Column(Integer, primary_key=True, autoincrement=True)
        account_user_name = Column(String(255), nullable=False)
        date_of_birth = Column(Date)
        email = Column(String(255))
        phone_number = Column(String(20))
        encrypted_password = Column(String(255), nullable=False)
        user_fname = Column(String(255))
        user_lname = Column(String(255))
        address = Column(String(255), nullable=False)
        suburb = Column(String(255))
        longitude = Column(DECIMAL(10, 7))
        latitude = Column(DECIMAL(10, 7))

    class Store(Base):
        __tablename__ = 'store'
        store_id = Column(Integer, primary_key=True, autoincrement=True)
        store_name = Column(String(255), nullable=False)
        store_chain = Column(String(255))
        store_address = Column(String(255))
        suburb = Column(String(255))
        city = Column(String(255))
        post_code = Column(String(10))
        longitude = Column(DECIMAL(10, 7))
        latitude = Column(DECIMAL(10, 7))

    class Product(Base):
        __tablename__ = 'product'
        product_id = Column(Integer, primary_key=True, autoincrement=True)
        product_code = Column(String(255), nullable=False)
        product_name = Column(String(255), nullable=False)
        category = Column(String(255), nullable=False)
        sub_category_1 = Column(String(255))
        sub_category_2 = Column(String(255))
        current_price = Column(DECIMAL(10, 2), nullable=False)
        unit_per_prod = Column(DECIMAL(10, 2))
        measurement = Column(String(255))
        link = Column(String(255))
        link_image = Column(String(255))

    class ProductPricing(Base):
        __tablename__ = 'product_pricing'
        product_pricing_id = Column(Integer, primary_key=True, autoincrement=True)
        product_id = Column(Integer, ForeignKey('product.product_id'), nullable=False)
        date = Column(Date, nullable=False)
        price = Column(DECIMAL(10, 2), nullable=False)

    class Wish(Base):
        __tablename__ = 'wish'
        wish_id = Column(Integer, primary_key=True, autoincrement=True)
        product_id = Column(Integer, ForeignKey('product.product_id'), nullable=False)
        store_id = Column(Integer, ForeignKey('store.store_id'), nullable=False)
        quantity = Column(Integer, nullable=False)
        total_price = Column(DECIMAL(10, 2), nullable=False)

    class Wishlist(Base):
        __tablename__ = 'wishlist'
        wishlist_id = Column(Integer, primary_key=True, autoincrement=True)
        user_id = Column(Integer, ForeignKey('user.user_id'), nullable=False)
        wish_id = Column(Integer, ForeignKey('wish.wish_id'), nullable=False)
        date_created = Column(Date)

    # Encode the password for the connection string
    encoded_password = quote(db_password)

    # Connect to the newly created database
    engine = create_engine(f'postgresql+psycopg2://{db_user}:{encoded_password}@{db_host}/{db_name}')

    # Create all tables
    Base.metadata.create_all(engine)


if __name__ == "__main__":
    connect_and_create()
    create_database()