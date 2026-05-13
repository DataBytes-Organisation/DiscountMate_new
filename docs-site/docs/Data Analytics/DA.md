---
title: " "
sidebar_label: "Overview"
---

# Section Overview
Data Analytics leverages statistical analysis and machine learning techniques to identify insights for users, developers and key stakeholders of the DiscountMate web application. The following section details a number of the key applications utilised by the Data Analytics team and how to get them up and operational, as well as several key areas of past and current development and exploration.


## 1. Analytics Platforms  / Applications

### 1.1 Microsoft PowerBI

Power BI is **Microsoft’s business analytics platform** that connects to data, transforms it, and turns it into interactive visual reports and dashboards.   

**Why:** It’s important because it provides a **fast, scalable way to analyse data and surface insights to the DiscountMate web application**, letting users explore trends, compare metrics, and make informed decisions through embedded, interactive dashboards.

**How do I get started?**
Currently, in order to access the embedded PowerBI dashboards on the site, you will need to sign into your Deakin PowerBI account. First, you need to ensure that you can sign in to your PowerBI application with your **Deakin** Microsoft account. You can download the Desktop PowerBi version (preferable as it has more functionality) or use the web version. Note that MAC does not directly support PowerBI desktop, so you will need to access it via a Windows virtual desktop or use the browser version. In order to bring data into the application, there are two options utilised in this project 1) connect to the cloud database (i.e. MongoDB or PostgreSQL) or 2) import data directly a CSV / Excel / Sharpoint. 

The file will display a sample PowerBI Report for Discount Mate.

<a
  href="https://raw.githubusercontent.com/DataBytes-Organisation/DiscountMate_new/main/docs-site/docs/Data%20Analytics/PowerBI_DiscountMate_Sample.pdf"
  target="_blank"
  rel="noopener noreferrer"
  style={{
    display: 'inline-block',
    padding: '12px 20px',
    backgroundColor: '#2e8555',
    color: 'white',
    borderRadius: '6px',
    fontWeight: '600',
    textDecoration: 'none',
    fontSize: '16px',
    transition: 'background-color 0.2s ease',
  }}
  onMouseOver={e => (e.currentTarget.style.backgroundColor = '#256f47')}
  onMouseOut={e => (e.currentTarget.style.backgroundColor = '#2e8555')}
>
  📄 View GA DiscountMate Sample PDF
</a>
_______________________


### 1.2 Google Analytics

Google Analytics is **Google’s web and app measurement platform** that tracks how users interact with your site or product.  

**Why:** It’s important because it provides **real‑time insight into user behavior, traffic sources, and engagement**, allowing teams to optimize experiences and embed meaningful analytics into web applications such as DiscountMate for data‑driven decisions.

<a
  href="https://raw.githubusercontent.com/DataBytes-Organisation/DiscountMate_new/main/docs-site/docs/Data%20Analytics/GA_DiscountMate_Sample.pdf"
  target="_blank"
  rel="noopener noreferrer"
  style={{
    display: 'inline-block',
    padding: '12px 20px',
    backgroundColor: '#2e8555',
    color: 'white',
    borderRadius: '6px',
    fontWeight: '600',
    textDecoration: 'none',
    fontSize: '16px',
    transition: 'background-color 0.2s ease',
  }}
  onMouseOver={e => (e.currentTarget.style.backgroundColor = '#256f47')}
  onMouseOut={e => (e.currentTarget.style.backgroundColor = '#2e8555')}
>
  📄 View GA DiscountMate Sample PDF
</a>
________
_______________________

### 1.3 Python Scripts / Jupyter Notebooks

A significant portion of the data cleansing, data exploration and statistical and machine learning models will be developed using python. Please refer to the Introduction Page of this onboarding guide to learn how to install python and the required libraries in your local environment / or access Google Colabs (or alternative online solution). 


## 2. Key Development Areas

The most recent focus areas for the Data Analytocs team has been as follows:

**Focus Area 1: [DA-01] Insight Reporting and Visualization** This task is focused on developing dashboards and surfacing thos visulizations in the web application (Power BI, Tableau, or Dash). The objective to present price trends / comparisions / time series analysis across both common products and retailers on a weekly or monthly basis. These dashboards should be interactive and visually appealing, they should also allow end users the ability to customise certain filters to tailor the results.

**Focus Area 2: [DA-02] Retail Discount Leadership & Follow-On Pricing Pattern Analysis** Ensuring that pricing discounts and specials are of 'real value' as opposed to insignificant discounts. Similarly, detailed analysis of pricing patterns over time, seasons, key purchase periods and impact from external factors all contribute to the end price a consumer pays for a product, the ability to predict such price triggers seperates DiscountMate from other grocery price comparision platforms which focus soley on current price. 

**Focus Area 3: [DA-03] Product Deduplication & Matching - Match same product across supermarkets** Core to DiscountMate is the ability to match like-for-like and similar products and their respective pricing across retailers in order to fair comparisions and offer the broadest range of relevant alternatives. 

**Focus Area 4: [DA-04] WebSite Analytics** Key to any functional website are detailed behavioural analytics.

**Focus Area 5: [DA-05] Persona to Product Mapping** Extending product information and tagging them with pre-defined personas and aligning these with user cohorts can enable the web application to present a tailored and more relevant product / category recommendations, which will also form the basis for a recommendation engine. 

**Focus Area 6: [DA-06] Product Price Volatility and Elasticity** Specific focus on price volatility and elascitity through machine learning and statistical models can highlight key patterns in the data to act as predictive tools for price discounts ana specials, which ultimately assists consumers on when is the most optimal time  / price to purchase a product (if any exists).