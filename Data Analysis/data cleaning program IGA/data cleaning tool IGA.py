#!/usr/bin/env python
# coding: utf-8

# In[41]:


import pandas as pd
import re
import matplotlib.pyplot as plt
import seaborn as sns

# ----------------------------------------
# LOADING AND BACKING UP
# ----------------------------------------

# Loading the unclean grocery dataset from IGA
df = pd.read_csv('IGA 1.csv')

# Keeping a full backup for comparison later (before any imputation or changes)
df_before = df.copy()

# ----------------------------------------
# EXTRACTING PRICE AND UNIT
# ----------------------------------------

# This function pulls out numeric price and unit type (like 'each' or 'per 100g') from raw price strings
def extract_price_and_unit(value):
    match = re.match(r'\$(\d+\.?\d*)(?:\s*)(each|per\s*[\d\w]+)', str(value).lower())
    if match:
        price = float(match.group(1))   # Converting the price string to float
        unit = match.group(2).strip()   # Grabbing and cleaning the unit type
        return price, unit
    return None, None

# Applying the extraction function to both price columns
df['unit_price_value'] = df['Unit Price'].apply(lambda x: extract_price_and_unit(x)[0])
df['unit_price_unit'] = df['Unit Price'].apply(lambda x: extract_price_and_unit(x)[1])
df['best_unit_price_value'] = df['Best Unit Price'].apply(lambda x: extract_price_and_unit(x)[0])
df['best_unit_price_unit'] = df['Best Unit Price'].apply(lambda x: extract_price_and_unit(x)[1])

# Standardizing unit labels to lowercase and trimming extra spaces
df['unit_price_unit'] = df['unit_price_unit'].str.lower().str.strip()
df['best_unit_price_unit'] = df['best_unit_price_unit'].str.lower().str.strip()

# Also copying these into the backup version to compare in the plot later
df_before['unit_price_value'] = df['unit_price_value']
df_before['best_unit_price_value'] = df['best_unit_price_value']

# ----------------------------------------
# HANDLING NA VALUES 
# ----------------------------------------

# Filling missing price values using the median price within each category
df['unit_price_value'] = df['unit_price_value'].fillna(df.groupby('Category')['unit_price_value'].transform('median'))
df['best_unit_price_value'] = df['best_unit_price_value'].fillna(df.groupby('Category')['best_unit_price_value'].transform('median'))

# Grabbing the most common unit used in each category
most_common_unit = df.groupby('Category')['unit_price_unit'].agg(lambda x: x.mode().iloc[0] if not x.mode().empty else None)

# Applying the common unit to rows with missing unit types
df['unit_price_unit'] = df.apply(
    lambda row: most_common_unit[row['Category']] if pd.isna(row['unit_price_unit']) else row['unit_price_unit'],
    axis=1
)

# Assuming that the unit type for best price should match and assigning it here
df['best_unit_price_unit'] = df['unit_price_unit']

# ----------------------------------------
# CLEANING RAW PRICE COLUMNS
# ----------------------------------------

# Some original columns like "Item Price" or "Price Was" still have symbols or text — so I’m cleaning them to float
def clean_price_column(series):
    return pd.to_numeric(series.astype(str).str.replace(r'[^0-9.]', '', regex=True), errors='coerce')

# Cleaning all price-related columns that came from the raw dataset
df['Item Price'] = clean_price_column(df['Item Price'])
df['Best Unit Price'] = clean_price_column(df['Best Unit Price'])
df['Price Was'] = clean_price_column(df['Price Was'])

# ----------------------------------------
# SAVING THE CLEANED DATASET
# ----------------------------------------

# Exporting the cleaned version
df.to_csv("cleaned_IGA_unit_prices.csv", index=False)

# ----------------------------------------
# PLOTTING KDE CURVES FOR UNIT PRICE AND BEST UNIT PRICE-BEFORE AND AFTER
# ----------------------------------------

# Visually checking how the imputation changed the distributions
# The before and after curves should look fairly similar

# First checking for unit price
plt.figure(figsize=(8, 5))
sns.kdeplot(df_before['unit_price_value'].dropna(), label='Before Imputation',
            color='red', linewidth=2)
sns.kdeplot(df['unit_price_value'].dropna(), label='After Imputation',
            color='green', linewidth=2, linestyle='--')
plt.title('KDE Plot of Unit Price Value (Before vs After Imputation)')
plt.xlabel('Unit Price Value')
plt.ylabel('Density')
plt.legend()
plt.show()

# Now doing the same check for best unit price
plt.figure(figsize=(8, 5))
sns.kdeplot(df_before['best_unit_price_value'].dropna(), label='Before Imputation',
            color='blue', linewidth=2)
sns.kdeplot(df['best_unit_price_value'].dropna(), label='After Imputation',
            color='orange', linewidth=2, linestyle='--')
plt.title('KDE Plot of Best Unit Price Value (Before vs After Imputation)')
plt.xlabel('Best Unit Price Value')
plt.ylabel('Density')
plt.legend()
plt.show()

# ----------------------------------------
# DETECTING OUTLIERS USING IQR METHOD
# ----------------------------------------

# I used the IQR rule here: any price that's too far below Q1 or above Q3 is marked as an outlier
# Just grabbing the top 5 lowest and top 5 highest to inspect manually

def get_top_outliers_iqr(df, column, top_n=5):
    Q1 = df[column].quantile(0.25)
    Q3 = df[column].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR

    # Separating out the extreme values on both ends
    low_outliers = df[df[column] < lower_bound].copy()
    high_outliers = df[df[column] > upper_bound].copy()

    top_low = low_outliers.sort_values(by=column).head(top_n)
    top_high = high_outliers.sort_values(by=column, ascending=False).head(top_n)

    return top_low, top_high

# Only running outlier checks on columns that are fully numeric and consistent across rows
target_columns = ['Item Price', 'Price Was']

# Looping through the selected columns and displaying the most extreme values
for col in target_columns:
    if col in df.columns:
        print(f"\nOutliers in '{col}':")
        low, high = get_top_outliers_iqr(df, col)
        print(f"\nLowest Outliers:")
        print(low[[col]])
        print(f"\nHighest Outliers:")
        print(high[[col]])

        # ----------------------------------------
# ENCODING CATEGORICAL FEATURES
# ----------------------------------------

# Frequency encoding for Category — this gives a numeric representation of how common each category is
# Can be helpful for feature engineering or sorting categories by importance
cat_freq = df['Category'].value_counts(normalize=True)
df['Category_freq_encoded'] = df['Category'].map(cat_freq)

# One-hot encoding for unit_price_unit — turns unit types into usable binary columns
# Good for models or grouped analysis (e.g., price by unit type)
df = pd.get_dummies(df, columns=['unit_price_unit'], drop_first=True)


# ### KDE Plot Summary
# The KDE plots comparing the distributions before and after imputation for unit price value and best unit price value show very strong alignment. The overall shape of both distributions remains consistent, with only a slight increase in the central peak after imputation. This is expected because missing values were filled using the median within each category, leading to higher density around common values. The minimal difference between the curves suggests that the imputation process preserved the statistical integrity of the data, without introducing distortion or bias.
# ### Outlier Detection
# The outlier analysis identified five high-value entries in the item price column, ranging from 100 to 126.99. These were flagged using the IQR method and may indicate premium items, special offers, or potential issues such as unit misinterpretation or data entry errors. No unusually low values were found. Similarly, the price was column showed outliers on the higher end, with values between 105 and 127, likely reflecting original prices before discounts. Since the analysis involves discount trends and pricing models, it is important to review these records closely to ensure they do not introduce skew or inaccuracies in calculating discounts, promotions, or price-based segmentation.

# In[ ]:




