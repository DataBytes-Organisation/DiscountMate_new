{{
    config(
        materialized='incremental',
        unique_key='basket_sk'
    )
}}

select
    basket_sk,
    basket_id,
    user_id,
    account_user_name,
    product_id,
    product_name,
    brand,
    sub_category,
    store_id,
    store_name,
    store_chain,
    store_city,
    quantity,
    total_price
from {{ ref('int_basket_details') }}