## Overview

- Groceries are too expensive so this is something to make cross-checking easier.

- These are basic web-scraping scripts for Australian supermarket websites Coles and Woolworths.

- Each script produces a CSV file with the pricing and special information for every product each supermarket sells.

- Handles complex promotions (2 for $6 etc) and reports on 'was' pricing as well as unit pricing.

- No error handling at present, as I am not sure how often the DOM structure changes on each site and need to test for longer.

Scripts take a few hours to run, I recommend creating a scheduled task to run these overnight, to let you compare prices in the morning.

## Getting Started

- Download **EdgeDriver** from [here](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/) and place it somewhere in your PATH (I use _%LocalAppData%\Programs\Python\Python311_ for simplicity)

- Copy this repo and run _pip install -r requirements.txt_ from within it's folder

- Execute the scraper i.e. _python scraper_coles.py_

- ...profit

## IMPORTANT

Configuration Setup

- Copy .env.example and rename it to .env

- Input sensitive credentials such as API keys, MongoDB connection strings, and proxy credentials into the .env file

- Do not commit .env to version control — it should be listed in .gitignore

- General settings like run flags, store types, or scraping options should go in configuration.ini
