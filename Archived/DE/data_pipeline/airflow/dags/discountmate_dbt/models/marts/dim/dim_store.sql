{{
    config(
        materialized='incremental',
        unique_key='_id'
    )
}}

select distinct 
    _id,
    trim(coalesce(store_name, 'unknown')) as store_name,
    trim(coalesce(store_chain, 'unknown')) as store_chain,
    trim(coalesce(store_address, 'unknown')) as store_address,
    trim(coalesce(store_suburb, 'unknown')) as store_suburb,
    trim(coalesce(store_city, 'unknown')) as store_city,
    coalesce(post_code, '0000') as post_code,
    trim(coalesce(phone_number, '0000000000')) as phone_number,
    trim(coalesce(link_image, '')) as link_image
from {{ ref('int_store_details') }}