import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import seaborn as sns
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
import joblib
import warnings
warnings.filterwarnings('ignore')

# Configure Streamlit page
st.set_page_config(
    page_title="Discount Mate - ML Dashboard",
    page_icon="🛒",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
<style>
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 0.5rem 0;
    }
    .big-font {
        font-size: 24px !important;
        font-weight: bold;
    }
    .prediction-high {
        color: #ff4b4b;
        font-weight: bold;
    }
    .prediction-medium {
        color: #ffa500;
        font-weight: bold;
    }
    .prediction-low {
        color: #00cc00;
        font-weight: bold;
    }
    .stMetric > label {
        font-size: 14px !important;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state for caching
if 'data_loaded' not in st.session_state:
    st.session_state.data_loaded = False
if 'model_loaded' not in st.session_state:
    st.session_state.model_loaded = False

# Simple predictor class for loading saved models
class DiscountPredictor:
    def __init__(self):
        self.model = None
        self.best_model = None
        self.best_threshold = 0.5
        self.label_encoders = {}
        self.encoders = {}
        self.feature_names = []
        self.feature_columns = []
        self.feature_importance = None
        self.model_type = 'original'
        self.scaler = None
    
    def load_model(self, model_path):
        try:
            model_data = joblib.load(model_path)
            
            # Handle both old and new model formats
            if 'best_model' in model_data:
                self.best_model = model_data['best_model']
                self.model = model_data['best_model']
                self.feature_columns = model_data.get('feature_columns', [])
                self.feature_names = model_data.get('feature_columns', [])
                self.encoders = model_data.get('encoders', {})
                self.label_encoders = model_data.get('encoders', {})
                self.scaler = model_data.get('scaler', None)
                
                # Check if this is the balanced model
                if 'best_threshold' in model_data:
                    self.best_threshold = model_data['best_threshold']
                    self.model_type = 'balanced'
                else:
                    self.model_type = 'original'
            else:
                # Legacy format
                self.model = model_data['model']
                self.best_model = model_data['model']
                self.label_encoders = model_data['label_encoders']
                self.encoders = model_data['label_encoders']
                self.feature_names = model_data['feature_names']
                self.feature_columns = model_data['feature_names']
                self.feature_importance = model_data.get('feature_importance', None)
            
            return True
        except Exception as e:
            st.error(f"Error loading model: {e}")
            return False
    
    def predict_discount_probability(self, data):
        if isinstance(data, dict):
            data = pd.DataFrame([data])
        
        # Encode categorical features
        for col in ['supermarket', 'category']:
            if col in data.columns and f'{col}_encoded' in self.feature_names:
                if col in self.label_encoders:
                    try:
                        data[f'{col}_encoded'] = self.label_encoders[col].transform(
                            data[col].astype(str).fillna('Unknown')
                        )
                    except ValueError:
                        data[f'{col}_encoded'] = 0
        
        # Select features
        available_features = [f for f in self.feature_names if f in data.columns]
        X_pred = data[available_features].copy()
        
        # Add missing features with default values
        for feature in self.feature_names:
            if feature not in X_pred.columns:
                X_pred[feature] = 0
        
        X_pred = X_pred[self.feature_names]
        
        # Make predictions
        if self.model_type == 'balanced' and self.scaler is not None and 'logistic' in str(type(self.model)).lower():
            X_pred = self.scaler.transform(X_pred)
        
        probabilities = self.model.predict_proba(X_pred)[:, 1]
        
        # Use optimized threshold for balanced model
        predictions = (probabilities >= self.best_threshold).astype(int)
        
        return probabilities, predictions

@st.cache_data
def load_pricing_data():
    """Load pricing data with caching for better performance."""
    try:
        df = pd.read_csv('discount_mate_dataset.csv')
        
        # Convert date column to datetime
        df['date'] = pd.to_datetime(df['date'])
        
        # Map columns to expected format
        column_mapping = {
            'discount_price': 'price',
            'regular_price': 'original_price',
            'supermarket_chain': 'supermarket',
            'is_on_discount': 'is_on_sale',
            'subcategory': 'product_name'
        }
        
        for old_col, new_col in column_mapping.items():
            if old_col in df.columns and new_col not in df.columns:
                df[new_col] = df[old_col]
        
        # Calculate discount_percent if not present
        if 'discount_percent' not in df.columns:
            df['discount_percent'] = ((df['original_price'] - df['price']) / df['original_price'] * 100).fillna(0)
        
        # Clean boolean columns
        boolean_columns = ['is_on_sale', 'discount_next_week']
        for col in boolean_columns:
            if col in df.columns:
                if df[col].dtype == 'object':
                    df[col] = df[col].astype(str).map({
                        'True': True, 'False': False, '1': True, '0': False,
                        'true': True, 'false': False, '1.0': True, '0.0': False
                    }).fillna(False).astype(bool)
        
        return df
    except FileNotFoundError:
        st.error("Pricing data file not found. Please run the data generation script first.")
        return None

@st.cache_resource
def load_trained_model():
    """Load the trained ML model with caching."""
    try:
        predictor = DiscountPredictor()
        # Try balanced model first, then fallback to original
        if predictor.load_model('balanced_discount_predictor.pkl'):
            return predictor
        elif predictor.load_model('discount_predictor_model.pkl'):
            return predictor
        return None
    except FileNotFoundError:
        st.error("Trained model not found. Please train the model first.")
        return None

def create_price_trend_chart(df, product_name, supermarket=None):
    """Create an interactive price trend chart for a specific product."""
    # Filter data for the specific product
    if supermarket:
        product_data = df[(df['product_name'] == product_name) & (df['supermarket'] == supermarket)]
    else:
        product_data = df[df['product_name'] == product_name]
    
    if product_data.empty:
        return None
    
    # Create the chart
    fig = go.Figure()
    
    # Add price lines for each supermarket
    for store in product_data['supermarket'].unique():
        store_data = product_data[product_data['supermarket'] == store].sort_values('date')
        
        # Regular price line
        fig.add_trace(go.Scatter(
            x=store_data['date'],
            y=store_data['price'],
            mode='lines+markers',
            name=f'{store} - Price',
            line=dict(width=2),
            hovertemplate='<b>%{fullData.name}</b><br>' +
                         'Date: %{x}<br>' +
                         'Price: $%{y:.2f}<br>' +
                         '<extra></extra>'
        ))
        
        # Highlight discount periods
        discount_data = store_data[store_data['is_on_sale']]
        if not discount_data.empty:
            fig.add_trace(go.Scatter(
                x=discount_data['date'],
                y=discount_data['price'],
                mode='markers',
                name=f'{store} - On Sale',
                marker=dict(size=10, symbol='star', color='red'),
                hovertemplate='<b>SALE!</b><br>' +
                             'Store: ' + store + '<br>' +
                             'Date: %{x}<br>' +
                             'Sale Price: $%{y:.2f}<br>' +
                             '<extra></extra>'
            ))
    
    # Update layout
    fig.update_layout(
        title=f'Price Trends: {product_name}',
        xaxis_title='Date',
        yaxis_title='Price ($)',
        hovermode='x unified',
        height=500,
        showlegend=True
    )
    
    return fig

def create_discount_analysis_charts(df):
    """Create comprehensive discount analysis visualizations."""
    # 1. Discount frequency by supermarket
    discount_by_store = df.groupby('supermarket')['is_on_sale'].agg(['mean', 'count']).reset_index()
    discount_by_store.columns = ['supermarket', 'discount_rate', 'total_products']
    
    fig1 = px.bar(
        discount_by_store.sort_values('discount_rate', ascending=True),
        x='discount_rate',
        y='supermarket',
        orientation='h',
        title='Discount Frequency by Supermarket',
        labels={'discount_rate': 'Discount Rate (%)', 'supermarket': 'Supermarket'},
        color='discount_rate',
        color_continuous_scale='RdYlBu_r'
    )
    fig1.update_traces(texttemplate='%{x:.1%}', textposition='inside')
    fig1.update_layout(height=400)
    
    # 2. Average discount percentage by category
    category_discounts = df[df['is_on_sale']].groupby('category')['discount_percent'].mean().reset_index()
    category_discounts = category_discounts.sort_values('discount_percent', ascending=True)
    
    fig2 = px.bar(
        category_discounts,
        x='discount_percent',
        y='category',
        orientation='h',
        title='Average Discount Percentage by Category',
        labels={'discount_percent': 'Average Discount (%)', 'category': 'Product Category'},
        color='discount_percent',
        color_continuous_scale='viridis'
    )
    fig2.update_traces(texttemplate='%{x:.1f}%', textposition='inside')
    fig2.update_layout(height=500)
    
    # 3. Discount patterns over time (by month)
    df['month_name'] = df['date'].dt.strftime('%B')
    monthly_discounts = df.groupby('month_name')['is_on_sale'].mean().reset_index()
    
    # Order months correctly
    month_order = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
    monthly_discounts['month_name'] = pd.Categorical(monthly_discounts['month_name'], 
                                                     categories=month_order, ordered=True)
    monthly_discounts = monthly_discounts.sort_values('month_name')
    
    fig3 = px.line(
        monthly_discounts,
        x='month_name',
        y='is_on_sale',
        title='Seasonal Discount Patterns',
        labels={'is_on_sale': 'Discount Rate', 'month_name': 'Month'},
        markers=True
    )
    fig3.update_traces(line_color='#1f77b4', marker_size=8)
    fig3.update_layout(height=400)
    
    return fig1, fig2, fig3

def predict_discount_for_product(predictor, product_data):
    """Make discount prediction for a specific product configuration."""
    try:
        prob, pred = predictor.predict_discount_probability(product_data)
        
        # Determine confidence level based on probability and model type
        if predictor.model_type == 'balanced':
            # Adjusted thresholds for balanced model
            if prob[0] >= 0.6:
                confidence = "High"
            elif prob[0] >= 0.3:
                confidence = "Medium"
            else:
                confidence = "Low"
        else:
            # Original thresholds
            if prob[0] >= 0.7:
                confidence = "High"
            elif prob[0] >= 0.4:
                confidence = "Medium"
            else:
                confidence = "Low"
            
        return prob[0], pred[0], confidence
    except Exception as e:
        st.error(f"Prediction error: {e}")
        return 0.0, 0, "Error"

def get_low_discount_reason(store_rate, category_rate, product_freq, recent_sale, days_since):
    """Helper function to determine why an item is unlikely to be discounted"""
    if store_rate < 0.25:
        return "Store rarely offers discounts"
    elif category_rate < 0.25:
        return "Category rarely discounted"
    elif product_freq < 0.15:
        return "Product historically stable pricing"
    elif recent_sale and days_since < 7:
        return "Recently was on sale"
    else:
        return "Multiple stability factors"

def show_dashboard_overview(df):
    """Display the main dashboard overview with key metrics and insights."""
    st.header("Dashboard Overview")
    
    # Key Metrics Row
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        total_products = df['product_name'].nunique()
        st.metric("Total Products", f"{total_products:,}")
    
    with col2:
        total_records = len(df)
        st.metric("Price Records", f"{total_records:,}")
    
    with col3:
        avg_discount_rate = df['is_on_sale'].mean()
        st.metric("Overall Discount Rate", f"{avg_discount_rate:.1%}")
    
    with col4:
        avg_discount_amount = df[df['is_on_sale']]['discount_percent'].mean()
        st.metric("Avg Discount When On Sale", f"{avg_discount_amount:.1f}%")
    
    st.markdown("---")
    
    # Charts Section
    st.subheader("Market Analysis")
    
    # Create discount analysis charts
    fig1, fig2, fig3 = create_discount_analysis_charts(df)
    
    # Display charts in columns
    col1, col2 = st.columns(2)
    
    with col1:
        st.plotly_chart(fig1, use_container_width=True)
        st.plotly_chart(fig3, use_container_width=True)
    
    with col2:
        st.plotly_chart(fig2, use_container_width=True)
        
        # Quick insights
        st.subheader("Quick Insights")
        
        # Find best discount store
        store_discounts = df.groupby('supermarket')['is_on_sale'].mean()
        best_discount_store = store_discounts.idxmax()
        best_rate = store_discounts.max()
        
        # Find category with highest discounts
        category_discounts = df[df['is_on_sale']].groupby('category')['discount_percent'].mean()
        best_discount_category = category_discounts.idxmax()
        best_category_rate = category_discounts.max()
        
        st.info(f"**Best for Discounts**: {best_discount_store} ({best_rate:.1%} discount rate)")
        st.info(f"**Highest Discount Category**: {best_discount_category} ({best_category_rate:.1f}% avg discount)")
        
        # Recent trends
        recent_data = df[df['date'] >= df['date'].max() - timedelta(days=30)]
        recent_discount_rate = recent_data['is_on_sale'].mean()
        
        if recent_discount_rate > avg_discount_rate:
            st.success(f"**Trending Up**: Discount activity increased to {recent_discount_rate:.1%} in the last 30 days!")
        else:
            st.warning(f"**Trending Down**: Discount activity decreased to {recent_discount_rate:.1%} in the last 30 days")

def show_discount_predictor(df, predictor):
    """Display the discount prediction interface."""
    st.header("AI Discount Predictor")
    
    # Show model status
    if predictor.model_type == 'balanced':
        st.success("Using Improved Balanced Model - 81% recall for finding discounts!")
    else:
        st.info("Using Original Model")
    
    # Create tabs for different prediction views
    tab1, tab2, tab3 = st.tabs(["Single Product Prediction", "Items Likely to Discount", "Items NOT Expected to Discount"])
    
    with tab1:
        st.markdown("Enter product details to predict discount probability for next week")
        
        # Prediction Form
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("Product Information")
            
            # Product selection
            available_products = sorted(df['product_name'].unique())
            selected_product = st.selectbox("Select Product", available_products)
            
            # Supermarket selection
            available_stores = sorted(df['supermarket'].unique())
            selected_store = st.selectbox("Select Supermarket", available_stores)
            
            # Category (auto-filled based on product)
            if selected_product:
                product_category = df[df['product_name'] == selected_product]['category'].iloc[0]
                st.text_input("Category", value=product_category, disabled=True)
            
            # Price input
            current_price = st.number_input("Current Price ($)", min_value=0.01, value=5.00, step=0.01)
            
        with col2:
            st.subheader("Market Context")
            
            # Calculate contextual features
            if selected_product and selected_store:
                hist_data = df[(df['product_name'] == selected_product) & 
                              (df['supermarket'] == selected_store)]
                
                if not hist_data.empty:
                    avg_price = hist_data['price'].mean()
                    recent_discounts = hist_data['is_on_sale'].tail(4).sum()
                    competitor_avg = df[df['product_name'] == selected_product]['price'].mean()
                else:
                    avg_price = current_price
                    recent_discounts = 0
                    competitor_avg = current_price
            else:
                avg_price = current_price
                recent_discounts = 0
                competitor_avg = current_price
            
            # Display context
            st.metric("Historical Avg Price", f"${avg_price:.2f}")
            st.metric("Recent Discounts (Last 4 weeks)", int(recent_discounts))
            st.metric("Competitor Average", f"${competitor_avg:.2f}")
            
            # Price position
            price_vs_competitors = (current_price - competitor_avg) / competitor_avg if competitor_avg > 0 else 0
            
            if price_vs_competitors > 0.05:
                st.warning(f"Price is {price_vs_competitors:.1%} above competitors")
            elif price_vs_competitors < -0.05:
                st.success(f"Price is {abs(price_vs_competitors):.1%} below competitors")
            else:
                st.info("Price is competitive with market")
        
        # Prediction Button
        st.markdown("---")
        
        if st.button("Predict Discount Probability", type="primary"):
            # Prepare prediction data
            prediction_data = {
                'price': current_price,
                'original_price': current_price,
                'discount_percent': 0,
                'supermarket': selected_store,
                'category': product_category,
                'price_vs_competitors': price_vs_competitors,
                'recent_discounts': recent_discounts,
                'week_of_year': datetime.now().isocalendar()[1],
                'month': datetime.now().month,
                'year': datetime.now().year,
                'price_percentile': 0.5,
                'is_month_end': 1 if datetime.now().day >= 28 else 0,
                'store_discount_tendency': df[df['supermarket'] == selected_store]['is_on_sale'].mean(),
                'category_discount_tendency': df[df['category'] == product_category]['is_on_sale'].mean(),
                'avg_competitor_price': competitor_avg,
                'price_change': 0,
                'price_zscore': (current_price - avg_price) / (hist_data['price'].std() if not hist_data.empty and hist_data['price'].std() > 0 else 1),
                'is_holiday_season': 1 if datetime.now().month in [12, 1] else 0,
                'quarter': ((datetime.now().month - 1) // 3) + 1,
                'day_of_week': datetime.now().weekday(),
                'is_cheapest': 1 if current_price <= competitor_avg * 0.95 else 0,
                'is_most_expensive': 1 if current_price >= competitor_avg * 1.05 else 0,
                'was_on_sale_last_week': 0,
                'price_change_from_last_week': 0,
                'discounts_last_4_weeks': recent_discounts,
                'avg_discount_when_on_sale': df[(df['supermarket'] == selected_store) & (df['is_on_sale'])]['discount_percent'].mean() if len(df[(df['supermarket'] == selected_store) & (df['is_on_sale'])]) > 0 else 15
            }
            
            # Make prediction
            probability, prediction, confidence = predict_discount_for_product(predictor, prediction_data)
            
            # Display results
            st.markdown("### Prediction Results")
            
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("Discount Probability", f"{probability:.1%}")
            
            with col2:
                result_text = "WILL BE ON SALE" if prediction == 1 else "NO SALE EXPECTED"
                st.metric("Prediction", result_text)
            
            with col3:
                st.metric("Confidence Level", confidence)
            
            # Visual indicator with adjusted thresholds for balanced model
            if predictor.model_type == 'balanced':
                if probability >= 0.6:
                    st.success(f"HIGH probability ({probability:.1%}) that {selected_product} at {selected_store} will be on sale next week!")
                elif probability >= 0.3:
                    st.warning(f"MEDIUM probability ({probability:.1%}) of discount. Keep watching!")
                else:
                    st.info(f"LOW probability ({probability:.1%}) of discount. Current price likely to continue.")
            else:
                if probability >= 0.7:
                    st.success(f"HIGH probability ({probability:.1%}) that {selected_product} at {selected_store} will be on sale next week!")
                elif probability >= 0.4:
                    st.warning(f"MEDIUM probability ({probability:.1%}) of discount. Keep watching!")
                else:
                    st.info(f"LOW probability ({probability:.1%}) of discount. Current price likely to continue.")
    
    with tab2:
        st.subheader("Items Likely to Go on Sale Soon")
        st.markdown("Products with high probability of being discounted in the next week")
        
        # Get recent data for prediction
        recent_data = df[df['date'] >= df['date'].max() - timedelta(days=7)].copy()
        
        if not recent_data.empty:
            high_discount_items = []
            
            # Find items with high discount probability patterns
            for (store, product), group in recent_data.groupby(['supermarket', 'product_name']):
                if len(group) > 0:
                    recent_discount_freq = group['is_on_sale'].mean()
                    days_since_discount = (group['date'].max() - group[group['is_on_sale']]['date'].max()).days if group['is_on_sale'].any() else 30
                    
                    category = group['category'].iloc[0]
                    store_discount_rate = df[df['supermarket'] == store]['is_on_sale'].mean()
                    category_discount_rate = df[df['category'] == category]['is_on_sale'].mean()
                    
                    # Simple scoring
                    if store_discount_rate > 0.3 and category_discount_rate > 0.3:
                        if days_since_discount > 14 or (recent_discount_freq < 0.2 and category_discount_rate > 0.35):
                            probability = min(0.8, store_discount_rate + category_discount_rate + (days_since_discount / 30))
                            high_discount_items.append({
                                'supermarket': store,
                                'product_name': product,
                                'category': category,
                                'current_price': group['price'].iloc[-1],
                                'probability': probability,
                                'days_since_discount': days_since_discount
                            })
            
            # Sort by probability and show top items
            if high_discount_items:
                high_discount_df = pd.DataFrame(high_discount_items).sort_values('probability', ascending=False).head(20)
                
                st.dataframe(
                    high_discount_df,
                    column_config={
                        "supermarket": "Store",
                        "product_name": "Product",
                        "category": "Category", 
                        "current_price": st.column_config.NumberColumn("Current Price", format="$%.2f"),
                        "probability": st.column_config.NumberColumn("Discount Probability", format="%.1%"),
                        "days_since_discount": "Days Since Last Sale"
                    },
                    hide_index=True
                )
                
                st.info(f"Found {len(high_discount_df)} items likely to go on sale based on historical patterns")
            else:
                st.warning("No high-probability discount items found in recent data")
        else:
            st.error("No recent data available for prediction")
    
    with tab3:
        st.subheader("Items NOT Expected to Go on Sale")
        st.markdown("Products with low probability of being discounted in the near future")
        
        # Get recent data
        recent_data = df[df['date'] >= df['date'].max() - timedelta(days=7)].copy()
        
        if not recent_data.empty:
            low_discount_items = []
            
            # Find items unlikely to be discounted
            for (store, product), group in recent_data.groupby(['supermarket', 'product_name']):
                if len(group) > 0:
                    category = group['category'].iloc[0]
                    
                    # Calculate factors indicating low discount probability
                    store_discount_rate = df[df['supermarket'] == store]['is_on_sale'].mean()
                    category_discount_rate = df[df['category'] == category]['is_on_sale'].mean()
                    product_discount_freq = df[(df['supermarket'] == store) & (df['product_name'] == product)]['is_on_sale'].mean()
                    
                    # Recently was on sale
                    recent_sale = group['is_on_sale'].any()
                    days_since_discount = 0
                    if group['is_on_sale'].any():
                        days_since_discount = (group['date'].max() - group[group['is_on_sale']]['date'].max()).days
                    
                    # Low probability if: low store/category discount rates, recently on sale, or rarely discounts
                    if (store_discount_rate < 0.25 or 
                        category_discount_rate < 0.25 or 
                        product_discount_freq < 0.15 or 
                        (recent_sale and days_since_discount < 7)):
                        
                        probability = max(0.05, min(0.4, store_discount_rate * category_discount_rate))
                        
                        low_discount_items.append({
                            'supermarket': store,
                            'product_name': product,
                            'category': category,
                            'current_price': group['price'].iloc[-1],
                            'probability': probability,
                            'reason': get_low_discount_reason(store_discount_rate, category_discount_rate, product_discount_freq, recent_sale, days_since_discount)
                        })
            
            # Sort by lowest probability
            if low_discount_items:
                low_discount_df = pd.DataFrame(low_discount_items).sort_values('probability').head(20)
                
                st.dataframe(
                    low_discount_df,
                    column_config={
                        "supermarket": "Store",
                        "product_name": "Product", 
                        "category": "Category",
                        "current_price": st.column_config.NumberColumn("Current Price", format="$%.2f"),
                        "probability": st.column_config.NumberColumn("Discount Probability", format="%.1%"),
                        "reason": "Why Unlikely to Discount"
                    },
                    hide_index=True
                )
                
                st.info(f"Found {len(low_discount_df)} items unlikely to go on sale soon")
                
                # Summary insights
                st.markdown("### Key Insights:")
                
                # Store analysis
                store_counts = low_discount_df['supermarket'].value_counts()
                st.write(f"**Stores with most stable pricing:** {', '.join(store_counts.head(3).index.tolist())}")
                
                # Category analysis  
                category_counts = low_discount_df['category'].value_counts()
                st.write(f"**Categories rarely discounted:** {', '.join(category_counts.head(3).index.tolist())}")
                # ==== APP WIREFRAME / MAIN ====
st.title("🛒 Discount Mate — ML Dashboard")

# Load data & model (cached)
df = load_pricing_data()
predictor = load_trained_model()

if (df is None) or (predictor is None):
    st.stop()

# Sidebar navigation
st.sidebar.header("Navigation")
page = st.sidebar.radio(
    "Go to",
    ["Overview", "AI Predictor", "Product Trends"],
    index=0
)

# Common sidebar filters
with st.sidebar:
    st.markdown("---")
    stores = sorted(df['supermarket'].dropna().unique().tolist())
    cats = sorted(df['category'].dropna().unique().tolist())
    selected_stores = st.multiselect("Filter stores", stores, default=stores)
    selected_cats = st.multiselect("Filter categories", cats, default=cats)
    date_min = df['date'].min()
    date_max = df['date'].max()
    date_range = st.date_input("Date range", [date_min, date_max])

# Apply filters safely
mask = (
    df['supermarket'].isin(selected_stores)
    & df['category'].isin(selected_cats)
    & (df['date'] >= pd.to_datetime(date_range[0]))
    & (df['date'] <= pd.to_datetime(date_range[1]))
)
df_view = df.loc[mask].copy()
if df_view.empty:
    st.warning("No data after filters. Adjust filters in the sidebar.")
    st.stop()

# Routes
if page == "Overview":
    show_dashboard_overview(df_view)

elif page == "AI Predictor":
    show_discount_predictor(df_view, predictor)

elif page == "Product Trends":
    st.header("Product Price Trends")
    pcols = st.columns(2)
    with pcols[0]:
        prod = st.selectbox("Product", sorted(df_view['product_name'].unique()))
    with pcols[1]:
        store_opt = st.selectbox("Supermarket (optional)", ["All"] + sorted(df_view['supermarket'].unique()))
        store_sel = None if store_opt == "All" else store_opt

    fig = create_price_trend_chart(df_view, prod, supermarket=store_sel)
    if fig:
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No price history found for the selected filters.")

elif page == "Data Preview":
    st.header("Dataset")
    st.dataframe(
        df_view.sort_values('date', ascending=False).head(200),
        use_container_width=True
    )
