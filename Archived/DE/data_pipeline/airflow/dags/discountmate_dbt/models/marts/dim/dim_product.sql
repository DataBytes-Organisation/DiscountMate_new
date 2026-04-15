{{
    config(
        materialized='incremental',
        unique_key='_id'
    )
}}

select distinct 
    _id,
    trim(coalesce(product_code, 'UNKNOWN')) as product_code,
    trim(coalesce(product_name, 'unknown')) as product_name,
    trim(coalesce(brand, 'unknown')) as brand,
    trim(coalesce(sub_category, 'unknown')) as sub_category,
    coalesce(currency_price, 'AUD') as currency_price,
    coalesce(current_price::numeric, 0) as current_price,
    trim(coalesce(link_image, '')) as link_image
from {{ ref('int_product_details') }}