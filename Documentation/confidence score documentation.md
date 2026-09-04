1.	Subcategory:
Suspected the sub-category can help define the confidence score so I grouped the sub-category by base score metric. 
I got the result and I appended the sub-category into 3 bins; less than 15, 15 to 30 bin and more than 30 bin that will be used later as a supplementary layer.

2.	Feature engineering to detect the columns and measure for confidence score. 
I converted the string to ordinal data, 0 for “Good Discount”, 1 for “OK discount”, 2 for “Excellent discount”, 3 for “DiscountMate Recommends”. 
I chose those columns ["saving_amount", "discount_percent", "base_score", "category_relative_score", "true_value_score", "saving_amount_capped"]. 
I split the train and test data load and the label is "converted_discount_class_v2". 
I normalised numeric data by standard scaler. 
I used neural network to predict the classes from the column.
The performance on the predictive model was good. 
Columns [“category_relative_score”, “true_value_score”, “discount_percent”, “base score”] have fairly good importance score. 
Then I checked statistic characteristic of the columns in the dataset. 
Then I assigned 0 class to the data that has less than 35% on the statistic. 1 accounted significantly like 0 class so I assigned 35% of the statistic and most of the data to it and 30% to class 2 and the rest to class 3 which is the least class. 
Then  add categories score by threshold, from 15 to 30 adds 0.25 to the score and more than 30 is 0.5. I ended up round but made it to 4 which is not the class. 

Then I check crosstab between the label and the confidence score. Many of class 0 and 1 are mistaken so I make class 0 to 1 and vice versa. Class 2 performs well but most of class 3 was confused with class 2 but there are not many class 3 and not enough data to train so I will ignore that. 
The final result was 0.76 in accuracy I satisfy with that and made the function for confidence score. 
The function has the chosen columns and depends on the values we assign it to the class. Then we add the supplementary score mapping it in the reverse order and return it as confidence score. 




