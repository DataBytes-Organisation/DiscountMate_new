## Overview

* Groceries are too goddamn expensive so this is something to make cross-checking easier. 

* These are basic web-scraping scripts for Australian supermarket websites Coles and Woolworths.

* Each script produces a CSV file with the pricing and special information for every product each supermarket sells. 

* Handles complex promotions (2 for $6 etc) and reports on 'was' pricing as well as unit pricing. 

* No error handling at present, as I am not sure how often the DOM structure changes on each site and need to test for longer. 


Scripts take a few hours to run, I recommend creating a scheduled task to run these overnight, to let you compare prices in the morning. 

## Getting Started

* Download **EdgeDriver** from [here](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/) and place it somewhere in your PATH (I use *%LocalAppData%\Programs\Python\Python311* for simplicity)

* Copy this repo and run *pip install -r requirements.txt* from within it's folder

* Modify the settings in *configuration.ini* to suit your local envoronment

* Execute the scraper i.e. *python scraper_coles.py*

* ...profit