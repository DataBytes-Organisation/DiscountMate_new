{% snapshot snapshot_stg_stores %}
{{
    config(
      target_schema='snapshots',
      unique_key='_id',
      strategy='check',
      check_cols=['store_name', 'store_chain', 'store_address', 'store_suburb', 'store_city', 'post_code', 'phone_number', 'link_image']
    )
}}
select
    _id,
    store_name,
    store_chain,
    store_address,
    store_suburb,
    store_city,
    post_code,
    phone_number,
    link_image
from {{ ref('stg_stores') }}
{% endsnapshot %} 