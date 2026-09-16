def confidence_score(df):
    threshold_df = {"<15": ['BAKEHOUSE', 'BAKERY CAKES/YEAST', 'BEEF/VEAL', 'DAIRY', 'FRESH CONVENIENCE', 'FRUIT', 'GROCERIES',
                         'HEALTH  BEAUTY BABY', 'HOME CARE', 'IN-STORE BH/BOUTIQUE', 'LIQUOR', 'MEAL SOLUTIONS', 'PORK/HAMS/BACON',
                         'PROPRIETARY BAKERY', 'SEAFOOD', 'SMALLGOODS/POULTRY', 'VALUE ADDED'],
                    
                    "15 - 30": ['BAKERY CAKES/YEAST', 'DAIRY', 'FRESH CONVENIENCE', 'FRUIT', 'FRUIT AND VEG', 'GENERAL MERCHANDISE', 'GROCERIES', 
                                'HEALTH  BEAUTY BABY','HOME CARE','IMPULSE', 'LAMB', 'LIQUOR', 'MEAL SOLUTIONS', 'POULTRY'],
                    ">= 30": ['APPAREL OUTERWEAR', 'BASIC APPAREL', 'GENERAL MERCHANDISE', 'GROCERIES', 'HEALTH  BEAUTY BABY',
                             'HOME CARE', 'IMPULSE', 'MEAL SOLUTIONS']}
    def cat_score(row):
        if row["category_group"] in threshold_df["15 - 30"]:
            return 0.25
        elif row["category_group"] in threshold_df[">= 30"]:
            return 0.5
        else:
            return 0

    res = []
    for _, row in df.iterrows():
        if (row["saving_amount"] < 1.25 and row["saving_amount_capped"] < 1.25) or ( (row["discount_percent"] < 20 and row["category_relative_score"] < 7) and (row["true_value_score"] < 25 and row["base_score"] < 20)):
                    score = 0
        elif ((1.25 <= row["saving_amount"] < 3 and 1.5 <= row["saving_amount_capped"] < 5) or (20 <= row["discount_percent"] < 40 and 7 <= row["category_relative_score"] < 13) or ( 25 <= row["true_value_score"] < 50 and 20 <= row["base_score"] < 36 )):
            score = 1
        elif (
            (
                3 <= row["saving_amount"] < 20
                and 5 <= row["saving_amount_capped"] < 15
            )
            or
            (
                40 <= row["discount_percent"] < 70
                and 13 <= row["category_relative_score"] < 15
            )
            and
            (
                50 <= row["true_value_score"] < 70
                and 36 <= row["base_score"] < 60
            )
        ):
            score = 2
        else:
            score = 3

        score += cat_score(row)
        res.append(round(score))

    mapping = {
        0: 1,
        1: 0,
        2: 2,
        3: 2,
        4: 3
    }

    preds_rule = [mapping[x] for x in res]
    return preds_rule
