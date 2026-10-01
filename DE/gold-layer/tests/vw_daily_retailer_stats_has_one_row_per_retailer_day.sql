-- Duplicate rows would make a retailer's daily statistics ambiguous.
select
    stats_date,
    retailer_id
from {{ ref('vw_daily_retailer_stats') }}
group by 1, 2
having count(*) > 1

