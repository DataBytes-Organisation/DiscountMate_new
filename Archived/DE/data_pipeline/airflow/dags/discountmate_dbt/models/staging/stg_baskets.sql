with source as (
    select * from {{ source('landing', 'baskets') }}
),

cleaned as (
    select distinct
        _id,
        user_id,
        product_id,
        store_id,
        coalesce(quantity::numeric, 0) as quantity,
        coalesce(total_price::numeric, 0) as total_price,
        coalesce(date_created::timestamp, current_timestamp) as date_created
    from source
    where _id is not null
        and user_id is not null
        and product_id is not null
        and store_id is not null
)

select * from cleaned