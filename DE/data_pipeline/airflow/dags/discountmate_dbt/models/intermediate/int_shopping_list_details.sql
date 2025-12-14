with shopping_list as (
    select * from {{ ref('stg_shopping_lists') }}
),
user_dim as (
    select * from {{ ref('snapshot_stg_users') }}
    where dbt_valid_to is null
),
shopping_list_item as (
    select * from {{ ref('stg_shopping_list_items') }}
)
select
    {{ dbt_utils.generate_surrogate_key(['shopping_list._id', 'shopping_list_item._id']) }} as shopping_list_sk,
    shopping_list._id as shopping_list_id,
    shopping_list.user_id,
    user_dim.account_user_name,
    shopping_list.date_created,
    shopping_list_item._id as shopping_list_item_id,
    shopping_list_item.item_name,
    shopping_list_item.quantity,
    shopping_list_item.note
from shopping_list
left join user_dim on shopping_list.user_id = user_dim._id
left join shopping_list_item on shopping_list._id = shopping_list_item.shopping_list_id
where
    user_dim._id is not null
    and shopping_list_item.item_name is not null