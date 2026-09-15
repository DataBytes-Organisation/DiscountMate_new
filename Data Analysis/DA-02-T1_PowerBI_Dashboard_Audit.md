# DA-02-T1 – Existing Power BI Dashboard Audit

## Dashboard reviewed
- Dashboard name: DiscountMate Product Price Comparison
- Files identified:
  - DiscountMate_Design.pbix
  - DiscountMate_V2.pbix
- Reviewed by: Senushi Ruwanya Kalawitigoda
- Review date: 29 July 2026

## Current visuals

| Visual | Purpose |
|---|---|
| Product price table | Displays product name, brand, price, unit price, quantity, retailer and special status |
| Product price comparison chart | Compares current product price and unit price |
| Cheapest product summary | Identifies the cheapest product |
| Cheapest unit price summary | Identifies the product with the lowest unit price |
| Product savings section | Shows the possible savings between selected products |
| Product image section | Displays selected product images |
| Product description table | Displays descriptions for selected products |
| Category slicer | Filters products by category |
| Brand slicer | Filters products by brand |
| Product selection slicer | Filters the dashboard by selected products |
| Clear selections button | Removes all active filters |

## Current data fields

The dashboard currently uses the following data fields:

- Most recent date
- Brand
- Product name
- Price
- Unit price
- Quantity
- Unit
- Retailer
- On-special status
- Category
- Product image
- Product description

## Current data sources

The Power BI files are available in the Data Analysis folder. However, the exact active data connection cannot be fully confirmed from VS Code because `.pbix` files must be opened in Power BI Desktop or the Power BI web workspace.

Possible data sources referenced in the project include:

- MongoDB
- CSV files
- Excel files
- Power BI workspace datasets

The exact source, table names, refresh configuration and connection credentials still need to be confirmed through Power BI workspace access.

## Current DAX layer

The dashboard appears to use measures or calculated fields for:

- Cheapest Product ($)
- Cheapest Product (Unit Price)
- Product Savings
- Most Recent Product Price
- Most Recent Date
- On-special status

The exact DAX formulas cannot be confirmed from VS Code. The `.pbix` file must be opened in Power BI Desktop or the Power BI workspace to inspect the measures.

## Current filters and interactions

The dashboard currently supports:

- Category filtering
- Brand filtering
- Product filtering
- Multiple product selections
- Clearing active selections
- Visual interaction between tables, charts and product details

## Current limitations

- The dashboard is mainly customer-facing and does not provide separate views for directors, mentors or internal teams.
- Some product names are difficult to read in the price chart.
- Some tables require horizontal scrolling.
- The exact data source and refresh process are not clearly documented.
- Existing DAX measures are not documented.
- The dashboard does not currently show stakeholder-specific operational insights.
- Power BI Desktop cannot be opened directly on macOS.

## Recommended next steps

- Obtain access to the Power BI workspace.
- Open the latest report and confirm whether `DiscountMate_V2.pbix` is the current version.
- Document the exact data source, tables and relationships.
- Export or record all DAX measures and formulas.
- Confirm the dataset refresh schedule.
- Identify which visuals should remain in the consumer-facing view.
- Use this audit to define stakeholder-specific views in DA-02-T2.