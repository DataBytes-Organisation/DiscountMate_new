Make sure you have Python installed on your machine

## Setting Up the Virtual Environment

Follow these steps to set up your development environment:

### 1. Create a Virtual Environment

Navigate to your project directory in the terminal, then run:

```bash
python -m venv venv


On windows: .\venv\Scripts\activate

On macOS: source venv/bin/activate



now perfrom in the virtual environment

pip install Flask

pip install -r requirements.txt





#################### ABOUT THE PROJECT ###########################

Create your account on elastic search and do a free trial for 15 days on https://www.elastic.co/

Now create a new API KEY and update the API Key info in the flask code

Update the MongoDB URL

##########################ENDPOINTS###############################

/search => Using POST Method send a JSON containing "product_name" returns the product with EXACT PRODUCT NAME

/searchBelow => Using POST Method send a JSON containing "max_price" returns all the products BELOW MAX_PRICE

/search_fuzzy => Using POST Method send a JSON containing "product_name" returns the product with SIMILAR PRODUCT NAME
```
