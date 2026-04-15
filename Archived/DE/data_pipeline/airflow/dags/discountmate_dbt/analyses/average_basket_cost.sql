with baskets as(
    select * from {{ ref('stg_baskets') }}
    where quantity > 0
        and total_price > 0
)

select 
    _id as basket_id,
    user_id,
    date_created,
    sum(total_price) as basket_total_cost,
    count(distinct product_id) as unique_products,
    sum(quantity) as total_items
from baskets
group by _id, user_id, date_created
order by date_created desc 