# Discount Mate - Time-Sensitive Deal Prediction Platform

## Project Overview
An AI-powered supermarket discount prediction system that helps consumers optimize their shopping timing by predicting when products will go on discount across major Australian supermarket chains.

## Problem Statement
Consumers struggle to know when everyday items like chips and milk will be discounted, leading to missed savings opportunities. This platform uses machine learning to predict discount patterns across supermarket chains.

## Dataset
- **Type**: Synthetic dataset based on real Australian supermarket patterns
- **Size**: 471,495 records over 2 years (2023-2025)
- **Stores**: 5 major chains (Woolworths, Coles, IGA, ALDI, Foodland)
- **Products**: 129 subcategories based on actual Coles data structure

## Key Achievement
Solved class imbalance problem and improved model recall from 14% to 81% using SMOTE oversampling and optimized thresholds.

## Files
- `TSDP.ipynb`: Complete ML pipeline and analysis
- `dashboard.py`: Interactive Streamlit dashboard
- `requirements.txt`: Required Python packages

## Usage
```bash
pip install -r requirements.txt
jupyter notebook TSDP.ipynb  # Run ML pipeline
streamlit run dashboard.py   # Launch dashboard