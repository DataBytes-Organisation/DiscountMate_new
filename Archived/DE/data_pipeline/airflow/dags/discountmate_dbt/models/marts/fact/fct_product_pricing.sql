{{
    config(
        materialized='incremental',
        unique_key='product_pricing_sk'
    )
}}

select
    product_pricing_sk,
    product_pricing_id,
    product_id,
    product_name,
    date,
    price
from {{ ref('int_product_pricing') }}