-- These identities encode the product-movement grain used by downstream reports.
with retailer_stats as (
    select * from {{ ref('vw_daily_retailer_stats') }}
)

select current_stats.*
from retailer_stats as current_stats
left join retailer_stats as previous_stats
    on previous_stats.retailer_id = current_stats.retailer_id
    and previous_stats.stats_date = current_stats.previous_stats_date
where
    current_stats.total_product_count
        <> current_stats.new_product_count
            + current_stats.retained_product_count
            + current_stats.returning_product_count
    or current_stats.price_increased_product_count
        + current_stats.price_decreased_product_count
        + current_stats.price_unchanged_product_count
        <> current_stats.retained_product_count
    or current_stats.on_special_product_count > current_stats.total_product_count
    or current_stats.new_product_count < 0
    or current_stats.removed_product_count < 0
    or current_stats.retained_product_count < 0
    or current_stats.returning_product_count < 0
    or (
        current_stats.previous_stats_date is null
        and (
            current_stats.removed_product_count <> 0
            or current_stats.retained_product_count <> 0
            or current_stats.returning_product_count <> 0
        )
    )
    or (
        current_stats.previous_stats_date is not null
        and previous_stats.stats_date is null
    )
    or (
        current_stats.previous_stats_date is not null
        and previous_stats.total_product_count
            <> current_stats.removed_product_count
                + current_stats.retained_product_count
    )
    or current_stats.minimum_price > current_stats.average_price
    or current_stats.average_price > current_stats.maximum_price

