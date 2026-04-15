with user_snapshot as (
    select * from {{ ref('snapshot_stg_users') }}
    where dbt_valid_to is null
)

select
    _id,
    account_user_name,
    login_email,
    best_price_id,
    created_by,
    date_created,
    latitude,
    longitude
from user_snapshot 