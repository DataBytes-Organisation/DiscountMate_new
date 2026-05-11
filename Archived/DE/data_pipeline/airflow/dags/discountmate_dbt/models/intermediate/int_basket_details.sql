with basket as (
    select * from {{ ref('stg_baskets') }}
    where quantity > 0
        and total_price > 0
),
user_dim as (
    select * from {{ ref('snapshot_stg_users') }}
    where dbt_valid_to is null
),
product as (
    select * from {{ ref('snapshot_stg_products') }}
    where dbt_valid_to is null
),
store as (
    select * from {{ ref('snapshot_stg_stores') }}
    where dbt_valid_to is null
)
select
    {{ dbt_utils.generate_surrogate_key(['basket._id', 'basket.user_id', 'basket.product_id', 'basket.store_id', 'basket.date_created']) }} as basket_sk,
    basket._id as basket_id,
    basket.user_id,
    user_dim.account_user_name,
    basket.product_id,
    product.product_name,
    product.brand,
    product.sub_category,
    basket.store_id,
    store.store_name,
    store.store_chain,
    store.store_city,
    basket.quantity,
    basket.total_price
from basket
inner join user_dim on basket.user_id = user_dim._id
inner join product on basket.product_id = product._id
inner join store on basket.store_id = store._id