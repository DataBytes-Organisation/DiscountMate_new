with store_snapshot as (
    select * from {{ ref('snapshot_stg_stores') }}
    where dbt_valid_to is null
)

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
from store_snapshot 