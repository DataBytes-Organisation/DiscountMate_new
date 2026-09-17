with price_observations as (
    select
        id as price_observation_id,
        (recorded_at at time zone 'Australia/Melbourne')::date as stats_date,
        recorded_at,
        product_id,
        category_id,
        retailer_id,
        price,
        unit_price,
        coalesce(is_on_special, false) as is_on_special,
        created_at
    from {{ source('silver', 'fct_product_prices') }} as price_observations
),

ranked_daily_products as (
    select
        *,
        row_number() over (
            partition by retailer_id, product_id, stats_date
            order by recorded_at desc, created_at desc, price_observation_id desc
        ) as observation_rank
    from price_observations
),

daily_products as (
    select
        stats_date,
        product_id,
        category_id,
        retailer_id,
        price,
        unit_price,
        is_on_special
    from ranked_daily_products
    where observation_rank = 1
),

available_dates as (
    select distinct
        retailer_id,
        stats_date
    from daily_products
),

retailer_dates as (
    select
        retailer_id,
        stats_date,
        lag(stats_date) over (
            partition by retailer_id
            order by stats_date
        ) as previous_stats_date
    from available_dates
),

product_history as (
    select
        *,
        min(stats_date) over (
            partition by retailer_id, product_id
        ) as first_seen_date
    from daily_products
),

current_product_stats as (
    select
        current_products.stats_date,
        dates.previous_stats_date,
        current_products.retailer_id,
        count(*) as total_product_count,
        count(*) filter (
            where current_products.first_seen_date = current_products.stats_date
        ) as new_product_count,
        count(previous_products.product_id) as retained_product_count,
        count(*) filter (
            where previous_products.product_id is null
                and current_products.first_seen_date < current_products.stats_date
        ) as returning_product_count,
        count(distinct current_products.category_id) as category_count,
        count(*) filter (
            where current_products.is_on_special
        ) as on_special_product_count,
        round(
            100.0 * count(*) filter (where current_products.is_on_special)
                / nullif(count(*), 0),
            2
        ) as on_special_product_percentage,
        round(avg(current_products.price), 2) as average_price,
        min(current_products.price) as minimum_price,
        max(current_products.price) as maximum_price,
        round(avg(current_products.unit_price), 4) as average_unit_price,
        count(*) filter (
            where previous_products.product_id is not null
                and current_products.price > previous_products.price
        ) as price_increased_product_count,
        count(*) filter (
            where previous_products.product_id is not null
                and current_products.price < previous_products.price
        ) as price_decreased_product_count,
        count(*) filter (
            where previous_products.product_id is not null
                and current_products.price = previous_products.price
        ) as price_unchanged_product_count
    from product_history as current_products
    inner join retailer_dates as dates
        on dates.retailer_id = current_products.retailer_id
        and dates.stats_date = current_products.stats_date
    left join daily_products as previous_products
        on previous_products.retailer_id = current_products.retailer_id
        and previous_products.product_id = current_products.product_id
        and previous_products.stats_date = dates.previous_stats_date
    group by
        current_products.stats_date,
        dates.previous_stats_date,
        current_products.retailer_id
),

removed_product_stats as (
    select
        dates.stats_date,
        dates.retailer_id,
        count(previous_products.product_id) filter (
            where current_products.product_id is null
        ) as removed_product_count
    from retailer_dates as dates
    left join daily_products as previous_products
        on previous_products.retailer_id = dates.retailer_id
        and previous_products.stats_date = dates.previous_stats_date
    left join daily_products as current_products
        on current_products.retailer_id = previous_products.retailer_id
        and current_products.product_id = previous_products.product_id
        and current_products.stats_date = dates.stats_date
    group by
        dates.stats_date,
        dates.retailer_id
),

retailers as (
    select
        id as retailer_id,
        retailer_name
    from {{ source('silver', 'dim_retailers') }} as retailers
)

select
    product_stats.stats_date,
    product_stats.previous_stats_date,
    product_stats.retailer_id,
    retailers.retailer_name,
    product_stats.total_product_count,
    product_stats.new_product_count,
    removed_stats.removed_product_count,
    product_stats.retained_product_count,
    product_stats.returning_product_count,
    product_stats.category_count,
    product_stats.on_special_product_count,
    product_stats.on_special_product_percentage,
    product_stats.average_price,
    product_stats.minimum_price,
    product_stats.maximum_price,
    product_stats.average_unit_price,
    product_stats.price_increased_product_count,
    product_stats.price_decreased_product_count,
    product_stats.price_unchanged_product_count
from current_product_stats as product_stats
inner join removed_product_stats as removed_stats
    using (stats_date, retailer_id)
inner join retailers
    using (retailer_id)

