import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)


DATA_PATH = "sample_data/chatbot_intent_examples.csv"


# --------------------------------------------------
# 1. Load dataset
# --------------------------------------------------

df = pd.read_csv(DATA_PATH)

print("Dataset loaded")
print(f"Number of examples: {len(df)}")
print("\nIntent distribution:")
print(df["intent"].value_counts())


# --------------------------------------------------
# 2. Basic validation
# --------------------------------------------------

required_columns = ["query", "intent"]

for column in required_columns:
    if column not in df.columns:
        raise ValueError(f"Missing required column: {column}")

df = df.dropna(subset=["query", "intent"])

df["query"] = df["query"].astype(str).str.strip()
df["intent"] = df["intent"].astype(str).str.strip()

df = df[df["query"] != ""]

print("\nClean dataset size:", len(df))


# --------------------------------------------------
# 3. Train / test split
# --------------------------------------------------

X = df["query"]
y = df["intent"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y
)


# --------------------------------------------------
# 4. TF-IDF + Logistic Regression
# --------------------------------------------------

model = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            sublinear_tf=True
        )
    ),
    (
        "classifier",
        LogisticRegression(
            max_iter=1000,
            class_weight="balanced"
        )
    )
])


# --------------------------------------------------
# 5. Train
# --------------------------------------------------

model.fit(X_train, y_train)

print("\nModel training completed.")


# --------------------------------------------------
# 6. Evaluate
# --------------------------------------------------

predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("\nAccuracy:", round(accuracy, 4))

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        predictions,
        zero_division=0
    )
)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, predictions))


# --------------------------------------------------
# 7. Interactive prediction function
# --------------------------------------------------

def predict_intent(query):

    probabilities = model.predict_proba([query])[0]

    classes = model.classes_

    best_index = np.argmax(probabilities)

    intent = classes[best_index]
    confidence = probabilities[best_index]

    return {
        "query": query,
        "intent": intent,
        "confidence": round(float(confidence), 4)
    }


# --------------------------------------------------
# 8. Test queries
# --------------------------------------------------

test_queries = [
    # price_comparison
    "Which supermarket has Coke Zero at the lowest price?",
    "Where can I get Nutella for less?",
    "Compare the prices of Weet-Bix.",
    "Which store sells milk for the cheapest price?",

    # product_search
    "Can you find pasta for me?",
    "Search for Milo products.",
    "Where can I find peanut butter?",
    "Show me some orange juice.",

    # product_details
    "What size is the Nutella jar?",
    "Tell me more about this product.",
    "What information do you have about Coke Zero?",
    "What is the pack size of Weet-Bix?",

    # retailer_search
    "What products are available at Coles?",
    "Show me Aldi products.",
    "What can I buy at Woolworths?",

    # category_search
    "Show me dairy products.",
    "What drinks are available?",
    "Find some snack products.",

    # product_substitution
    "What's a cheaper alternative to Milo?",
    "What can I buy instead of Nutella?",
    "Find something similar to Coke Zero.",

    # no_action
    "What's the weather like today?",
    "Tell me a joke.",
    "What is the capital of Australia?"
]

print("\nTest Predictions:")

for query in test_queries:

    result = predict_intent(query)

    print("\nQuery:", result["query"])
    print("Intent:", result["intent"])
    print("Confidence:", result["confidence"])