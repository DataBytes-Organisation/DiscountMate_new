import pandas as pd 
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.pipeline import make_pipeline
import seaborn as sns 
from sklearn.inspection import permutation_importance
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.cluster import KMeans

def convert_str(df, column):
    k = list(df[column].unique())
    n = np.arange(0, len(k), 1)
    
    res = {}
    for i in range(len(k)):
        res[k[i]] = int(n[i])
    return res

def persona_score(df, data = None):
    model = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("mlp", MLPClassifier(
            max_iter=100,
            random_state=42,
            hidden_layer_sizes=(100,)
        ))
    ])

    fea = [
        'convert raw main cat',
        'has_measurable_saving',
        'category_avg_discount',
        'convert promotion type',
        'converted brand',
        'converted retailer',
        'discount_percent',
        'saving_amount_capped',
        'true_value_score',
        'converted discount class v2'
    ]
    
    """ Some columns have string value and can't be feed into model
        So I convert them into numeric value in norminal data order
        P/S: I know promotion_type is ordinal but I can't find the document so I trested it as norminal.
             If you have resource, plz fix.
    """
    # The example of converting string column into numeric column
    # maps = convert_str(df, "raw_main_cat")
    # df["convert raw main cat"] = df["raw_main_cat"].map(maps)


    X = df[fea]

    # Replace missing values
    imputer = SimpleImputer(strategy="median")
    X_imp = imputer.fit_transform(X)

    # Scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imp)

    # Convert back to DataFrame
    X_scaled = pd.DataFrame(
        X_scaled,
        index=df.index,
        columns=fea
    )

    # K-Means with 6 clusters
    kmeans = KMeans(
        n_clusters=6,
        random_state=42,
        n_init=10
    )

    labels = kmeans.fit_predict(X_scaled)

    # Map K-Means cluster numbers to your desired persona labels
    true_label = {
        0: 1,
        4: 3,
        5: 4,
        1: 2,
        2: 0,
        3: 5
    }

    df['labels'] = labels
    y = df['labels'].map(true_label)

    print(X_scaled.head())
    print(y.head())

    
    # Train MLP
    model.fit(X_scaled, y)

    # Predict
    if data is not None:
        data_imp = imputer.transform(data[features])
        data_scaled = scaler.transform(data_imp)

        preds = model.predict(data_scaled)
    else:
        preds = None


    return model, preds








