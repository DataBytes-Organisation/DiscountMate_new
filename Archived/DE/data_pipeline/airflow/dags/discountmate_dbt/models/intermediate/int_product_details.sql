with product_snapshot as (
    select * from {{ ref('snapshot_stg_products') }}
    where dbt_valid_to is null
)

select
    _id,
    product_code,
    product_name,
    brand,
    sub_category,
    currency_price,
    current_price,
    link_image
from product_snapshot 