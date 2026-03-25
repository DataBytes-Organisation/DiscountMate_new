{% snapshot snapshot_stg_users %}
{{
    config(
      target_schema='snapshots',
      unique_key='_id',
      strategy='check',
      check_cols=['account_user_name', 'login_email', 'best_price_id', 'created_by', 'latitude', 'longitude']
    )
}}
select
    _id,
    account_user_name,
    login_email,
    best_price_id,
    created_by,
    date_created,
    latitude,
    longitude
from {{ ref('stg_users') }}
{% endsnapshot %}