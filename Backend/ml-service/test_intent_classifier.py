import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression


DATA_PATH = "sample_data/chatbot_intent_examples.csv"


# Load dataset
df = pd.read_csv(DATA_PATH)

df = df.dropna(subset=["query", "intent"])
df["query"] = df["query"].astype(str).str.strip()
df["intent"] = df["intent"].astype(str).str.strip()
df = df[df["query"] != ""]


# Prepare data
X = df["query"]
y = df["intent"]


# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y
)


# Build classifier
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


# Train model
model.fit(X_train, y_train)


def predict_intent(query):
    probabilities = model.predict_proba([query])[0]
    classes = model.classes_

    best_index = probabilities.argmax()

    return classes[best_index], probabilities[best_index]


# Unseen test queries
test_cases = [
    (
        "Which supermarket has Coke Zero at the lowest price?",
        "price_comparison"
    ),
    (
        "Can you find pasta for me?",
        "product_search"
    ),
    (
        "What is the pack size of Weet-Bix?",
        "product_details"
    ),
    (
        "What products are available at Coles?",
        "retailer_search"
    ),
    (
        "Find some snack products.",
        "category_search"
    ),
    (
        "What's a cheaper alternative to Milo?",
        "product_substitution"
    ),
    (
        "What's the weather like today?",
        "no_action"
    ),
    (
        "Where can I buy cereal?",
        "product_search"
    ),
    (
        "Compare the price of Nutella at different stores.",
        "price_comparison"
    ),
    (
        "Tell me about this product.",
        "product_details"
    ),
    (
        "What can I buy at Woolworths?",
        "retailer_search"
    ),
    (
        "Show me some dairy products.",
        "category_search"
    ),
    (
        "What can I use instead of peanut butter?",
        "product_substitution"
    ),
    (
        "Tell me a joke.",
        "no_action"
    )
]


# Run tests
passed = 0
failed = 0

print("\nIntent Classifier Test Results")
print("==============================")

for query, expected_intent in test_cases:

    predicted_intent, confidence = predict_intent(query)

    if predicted_intent == expected_intent:
        status = "PASS"
        passed += 1
    else:
        status = "FAIL"
        failed += 1

    print(f"\n[{status}]")
    print(f"Query: {query}")
    print(f"Expected: {expected_intent}")
    print(f"Predicted: {predicted_intent}")
    print(f"Confidence: {confidence:.4f}")


# Summary
total = len(test_cases)
accuracy = passed / total

print("\n==============================")
print("Test Summary")
print("==============================")
print(f"Total tests: {total}")
print(f"Passed: {passed}")
print(f"Failed: {failed}")
print(f"Accuracy: {accuracy:.2%}")