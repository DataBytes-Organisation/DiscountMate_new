with source as (
    select * from {{ source('landing', 'shopping_lists') }}
),

cleaned as(
    select distinct
        _id,
        COALESCE(user_id, 'unknown') AS user_id,
        COALESCE(date_created::timestamp, CURRENT_TIMESTAMP) AS date_created
    from source
)

select * from cleaned