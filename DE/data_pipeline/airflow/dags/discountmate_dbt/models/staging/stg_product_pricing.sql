with source as (
    select * from {{ source('landing', 'product_pricing') }}
),

cleaned as (
    select distinct
        _id,
        COALESCE(product_id, 'unknown') AS product_id,
        COALESCE(date::timestamp, CURRENT_TIMESTAMP) AS date,
        COALESCE(price::numeric, 0) AS price
    from source
    where price is not null and product_id is not null
)

select * from cleaned