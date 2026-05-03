with baskets as (
    select * from {{ ref('stg_baskets') }}
    where quantity > 0
        and total_price > 0
),

products as (
    select * from {{ ref('snapshot_stg_products') }}
    where dbt_valid_to is null
)

select 
    p.brand,
    count(distinct b._id) as baskets_with_brand,
    sum(b.quantity) as total_quantity,
    sum(b.total_price) as total_revenue,
    avg(b.total_price) as average_price,
    count(distinct b.user_id) as unique_customers
from baskets b
inner join products p on b.product_id = p._id
where p.brand is not null
group by p.brand
order by total_revenue desc 