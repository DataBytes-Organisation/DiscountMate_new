with source as (
    select * from {{ source('landing', 'shopping_list_items') }}
),

cleaned as(
    select distinct
        _id,
        COALESCE(shopping_list_id, 'unknown') AS shopping_list_id,
        TRIM(COALESCE(item_name, 'unknown')) AS item_name,
        COALESCE(quantity::numeric, 1) AS quantity,
        TRIM(COALESCE(note, '')) AS note
    from source
)

select * from cleaned