-- user
CREATE TABLE "user" (
    user_id SERIAL PRIMARY KEY,
    account_user_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    email VARCHAR(255),
    phone_number VARCHAR(20),
    encrypted_password VARCHAR(255) NOT NULL,
    user_fname VARCHAR(255),
    user_lname VARCHAR(255),
    address VARCHAR(255) NOT NULL,
    suburb VARCHAR(255),
    longitude DECIMAL(10, 7),
    latitude DECIMAL(10, 7)
);

--  store
CREATE TABLE store (
    store_id SERIAL PRIMARY KEY,
    store_name VARCHAR(255) NOT NULL,
    store_chain VARCHAR(255),
    store_address VARCHAR(255),
    suburb VARCHAR(255),
    city VARCHAR(255),
    post_code VARCHAR(10),
    longitude DECIMAL(10, 7),
    latitude DECIMAL(10, 7)
);

--  product
CREATE TABLE product (
    product_id SERIAL PRIMARY KEY,
    product_code VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    sub_category_1 VARCHAR(255),
    sub_category_2 VARCHAR(255),
    current_price DECIMAL(10, 2) NOT NULL,
    unit_per_prod DECIMAL(10, 2),
    measurement VARCHAR(255),
    link VARCHAR(255),
    link_image VARCHAR(255)
);

--  product_pricing
CREATE TABLE product_pricing (
    product_pricing_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES product(product_id),
    date DATE NOT NULL,
    price DECIMAL(10, 2) NOT NULL, 
    best_price DECIMAL(10, 2),
    best_unit_price DECIMAL(10, 4),
    unit_price DECIMAL(10, 4)
);


--  wish
CREATE TABLE wish (
    wish_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES product(product_id),
    store_id INTEGER NOT NULL REFERENCES store(store_id),
    quantity INTEGER NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL
);

--  wishlist
CREATE TABLE wishlist (
    wishlist_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(user_id),
    wish_id INTEGER NOT NULL REFERENCES wish(wish_id),
    date_created DATE
);

-- basket 
CREATE TABLE basket (
    basket_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(user_id),
    product_id INTEGER NOT NULL REFERENCES product(product_id),
    store_id INTEGER NOT NULL REFERENCES store(store_id),
    date_created DATE,
    quantity INTEGER NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL
);

-- shopping_list_item 
CREATE TABLE shopping_list_item (
    shopping_list_item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(255)
);

-- shopping_list 
CREATE TABLE shopping_list (
    shopping_list_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(user_id),
    shopping_list_item_id INTEGER NOT NULL REFERENCES shopping_list_item(shopping_list_item_id),
    date_created DATE
);

