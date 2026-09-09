from typing import List, Dict

def get_trending_categories_ml(limit: int = 3) -> List[Dict]:
    """
    Get trending category insights.
    Currently returns placeholder data; ready for real aggregation
    (e.g. groupby category on real discount data) once available.
    """
    trending = [
        {
            'category': 'Dairy Products',
            'avg_price_drop_pct': 23,
            'avg_savings': 2.40,
            'trend_label': 'price drop',
            'description': 'Average savings across milk, cheese, and yogurt',
            'icon': 'arrow-trend-down',
        },
        {
            'category': 'Household Essentials',
            'avg_price_drop_pct': None,
            'avg_savings': None,
            'trend_label': 'Hot deals',
            'description': 'Bulk deals on cleaning supplies and paper products',
            'icon': 'fire',
        },
        {
            'category': 'Fresh Produce',
            'avg_price_drop_pct': None,
            'avg_savings': None,
            'trend_label': 'Price watch',
            'description': 'Seasonal fruits and vegetables at best prices',
            'icon': 'chart-line',
        },
    ]
    return trending[:limit]