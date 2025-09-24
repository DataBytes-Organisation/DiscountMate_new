with pricing as (
    select * from {{ ref('stg_product_pricing') }}
),
product as (
    select * from {{ ref('stg_products') }}
)
select
    {{ dbt_utils.generate_surrogate_key(['pricing._id', 'pricing.product_id', 'pricing.date']) }} as product_pricing_sk,
    pricing._id as product_pricing_id,
    pricing.product_id,
    product.product_name,
    pricing.date,
    pricing.price
from pricing
left join product on pricing.product_id = product._id
where
    product._id is not null