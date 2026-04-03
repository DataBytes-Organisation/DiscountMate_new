{{
    config(
        materialized='incremental',
        unique_key='shopping_list_sk'
    )
}}

WITH fct_shopping_list AS (
    SELECT *
    FROM {{ ref('int_shopping_list_details') }}
)

SELECT *
FROM fct_shopping_list