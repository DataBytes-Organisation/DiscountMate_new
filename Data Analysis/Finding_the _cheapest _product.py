"""
This code enables the user to input a keyword to search for similar products. 
It processes the search results to identify products that match the input keyword 
and displayed in the csv file and then selects and returns the cheapest product among those similar items.
"""

import pandas as pd
from fuzzywuzzy import fuzz, process

# Load the CSV files
coles_file_path = 'Coles.csv'  # Update the file path if needed
woolworths_file_path = 'Woolworths.csv'  # Update the file path if needed

# Read the CSV files into DataFrames
coles_df = pd.read_csv(coles_file_path)
woolworths_df = pd.read_csv(woolworths_file_path)

# Helper function to clean item names
def clean_item_name(name):
    if isinstance(name, str):
        return name.lower().strip()  # Normalize to lowercase and strip extra spaces
    return name

# Clean product names in both datasets
coles_df['Item Name'] = coles_df['Item Name'].apply(clean_item_name)
woolworths_df['Item Name'] = woolworths_df['Item Name'].apply(clean_item_name)

# Ensure the prices are numeric and remove duplicates
coles_df['Best Price'] = coles_df['Best Price'].replace('[\$,]', '', regex=True).astype(float)
woolworths_df['Best Price'] = woolworths_df['Best Price'].replace('[\$,]', '', regex=True).astype(float)
coles_df = coles_df.drop_duplicates(subset=['Item Name'])
woolworths_df = woolworths_df.drop_duplicates(subset=['Item Name'])

# Function to find, display, and save partial matches
def find_display_and_save_matches(query, coles_df, woolworths_df, output_file='matching_products.csv', threshold=50):
    # Normalize the query for comparison
    query = query.lower().strip()

    # Find partial matches in Coles
    coles_matches = process.extract(query, coles_df['Item Name'], scorer=fuzz.partial_ratio)
    coles_results = [
        {'Store': 'Coles', 'Product Name': match[0], 'Price': coles_df.loc[coles_df['Item Name'] == match[0], 'Best Price'].values[0]}
        for match in coles_matches if match[1] >= threshold
    ]

    # Find partial matches in Woolworths
    woolworths_matches = process.extract(query, woolworths_df['Item Name'], scorer=fuzz.partial_ratio)
    woolworths_results = [
        {'Store': 'Woolworths', 'Product Name': match[0], 'Price': woolworths_df.loc[woolworths_df['Item Name'] == match[0], 'Best Price'].values[0]}
        for match in woolworths_matches if match[1] >= threshold
    ]

    # Combine results from both stores
    all_results = coles_results + woolworths_results

    if all_results:
        # Convert results to a DataFrame
        results_df = pd.DataFrame(all_results)

        # Display the results
        print("\nMatching Products Found:")
        print(results_df)

        # Find the cheapest item
        cheapest_item = results_df.loc[results_df['Price'].idxmin()]
        print("\nCheapest Product:")
        print(f"Store: {cheapest_item['Store']}, Product: {cheapest_item['Product Name']}, Price: ${cheapest_item['Price']:.2f}")

        # Save the results to a CSV file
        results_df.to_csv(output_file, index=False)
        print(f"\nResults saved to '{output_file}'.")
    else:
        print(f"No similar products found for '{query}'.")
        # Clear the output file since no matches were found
        pd.DataFrame(columns=['Store', 'Product Name', 'Price']).to_csv(output_file, index=False)

# Main function to handle user input
def main():
    output_file = 'matching_products.csv'  # Output file name

    while True:
        # Ask the user for a product name
        query = input("\nEnter the product name to search for (or type 'exit' to quit): ").strip()
        if query.lower() == 'exit':
            print("Exiting the program.")
            break

        # Find, display, and save matching products
        find_display_and_save_matches(query, coles_df, woolworths_df, output_file=output_file)

# Run the main function
if __name__ == "__main__":
    main()

