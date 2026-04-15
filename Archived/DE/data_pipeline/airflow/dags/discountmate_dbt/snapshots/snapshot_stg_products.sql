{% snapshot snapshot_stg_products %}
{{
    config(
      target_schema='snapshots',
      unique_key='_id',
      strategy='check',
      check_cols=['product_code', 'product_name', 'brand', 'sub_category', 'currency_price', 'current_price', 'link_image']
    )
}}
select
    _id,
    product_code,
    product_name,
    brand,
    sub_category,
    currency_price,
    current_price,
    link_image
from {{ ref('stg_products') }}
{% endsnapshot %} 