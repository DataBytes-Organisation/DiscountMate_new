with baskets as(
    select * from {{ ref('stg_baskets') }}
),
products as(
    select * from {{ ref('snapshot_stg_products') }}
    where dbt_valid_to is null
),
stores as(
    select * from {{ ref('snapshot_stg_stores') }}
    where dbt_valid_to is null
)

select
    b._id as basket_id,
    b.user_id,
    b.product_id,
    p.product_name,
    p.brand,
    p.sub_category,
    b.quantity,
    b.total_price,
    b.date_created,
    b.store_id,
    s.store_name,
    s.store_city,
    s.store_chain
from baskets b
inner join products p on b.product_id = p._id
inner join stores s on b.store_id = s._id
where b.quantity > 0
    and b.total_price > 0
order by b.date_created desc 