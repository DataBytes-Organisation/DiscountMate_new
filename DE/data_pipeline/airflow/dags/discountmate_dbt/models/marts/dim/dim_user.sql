{{
    config(
        materialized='incremental',
        unique_key='_id'
    )
}}

select distinct 
    _id,
    trim(coalesce(account_user_name, 'unknown')) as account_user_name,
    coalesce(best_price_id, 'N/A') as best_price_id,
    trim(coalesce(created_by, 'unknown')) as created_by,
    coalesce(date_created::timestamp, current_timestamp) as date_created,
    trim(coalesce(login_email, 'unknown@example.com')) as login_email,
    coalesce(latitude::numeric, 0) as latitude,
    coalesce(longitude::numeric, 0) as longitude
from {{ ref('int_user_details') }}