# DiscountMate Intent Classifier

## Purpose

This component provides baseline natural-language intent detection for the DiscountMate chatbot.

The classifier receives a user's natural-language shopping query and predicts the intended chatbot action. The predicted intent can then be used by later chatbot components for entity extraction and database search.

## Supported Intents

The classifier supports the seven intents defined for the DiscountMate chatbot:

- `price_comparison` - compare product prices across retailers.
- `product_search` - search for products.
- `product_details` - retrieve information about a specific product.
- `retailer_search` - find products or information associated with a retailer.
- `category_search` - search for products within a category.
- `product_substitution` - find alternatives or substitutes for a product.
- `no_action` - queries that are outside the supported shopping chatbot actions.

## Dataset

A manually labelled dataset of 173 natural-language queries was created for intent detection.

The current intent distribution is:

| Intent | Examples |
|---|---:|
| `product_search` | 27 |
| `category_search` | 29 |
| `retailer_search` | 25 |
| `price_comparison` | 23 |
| `product_details` | 23 |
| `product_substitution` | 23 |
| `no_action` | 23 |
| **Total** | **173** |

The examples contain varied natural-language query structures and include relevant shopping entities such as product names, brands, categories, retailers and pack sizes where applicable.

## Classification Approach

A baseline machine-learning approach was implemented using:

1. TF-IDF text vectorisation
2. Logistic Regression classification

The TF-IDF vectoriser uses unigram and bigram features. Logistic Regression is configured with balanced class weights to reduce the effect of differences in class frequency.

The processing pipeline is:

```text
Natural-language query
        |
        v
TF-IDF Vectorisation
        |
        v
Logistic Regression
        |
        v
Predicted Intent + Confidence