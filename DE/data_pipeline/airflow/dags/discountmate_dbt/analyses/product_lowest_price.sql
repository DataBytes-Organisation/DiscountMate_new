with product_prices as (
    select
        product_id,
        product_name,
        price
    from {{ ref('fct_product_pricing') }}
)

, ranked_prices as (
    select
        product_id,
        product_name,
        price,
        rank() over (order by price asc) as price_rank
    from product_prices
)

select
    product_id,
    product_name,
    price as lowest_price
from ranked_prices
where price_rank = 1