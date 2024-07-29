

# Software Requirements Specification
## For <project name>

Version 0.1  
Prepared by <author>  
DataBytes-Organisation / DiscountMate
20/04/2024  

Table of Contents
=================
* [Revision History](#revision-history)
* 1 [Introduction](#1-introduction)
  * 1.1 [Document Purpose](#11-document-purpose)
  * 1.2 [Product Scope](#12-product-scope)
  * 1.3 [Definitions, Acronyms and Abbreviations](#13-definitions-acronyms-and-abbreviations)
  * 1.4 [References](#14-references)
  * 1.5 [Document Overview](#15-document-overview)
* 2 [Product Overview](#2-product-overview)
  * 2.1 [Product Perspective](#21-product-perspective)
  * 2.2 [Product Functions](#22-product-functions)
  * 2.3 [Product Constraints](#23-product-constraints)
  * 2.4 [User Characteristics](#24-user-characteristics)
  * 2.5 [Assumptions and Dependencies](#25-assumptions-and-dependencies)
  * 2.6 [Apportioning of Requirements](#26-apportioning-of-requirements)
* 3 [Requirements](#3-requirements)
  * 3.1 [External Interfaces](#31-external-interfaces)
    * 3.1.1 [User Interfaces](#311-user-interfaces)
    * 3.1.2 [Hardware Interfaces](#312-hardware-interfaces)
    * 3.1.3 [Software Interfaces](#313-software-interfaces)
  * 3.2 [Functional](#32-functional)
  * 3.3 [Quality of Service](#33-quality-of-service)
    * 3.3.1 [Performance](#331-performance)
    * 3.3.2 [Security](#332-security)
    * 3.3.3 [Reliability](#333-reliability)
    * 3.3.4 [Availability](#334-availability)
  * 3.4 [Compliance](#34-compliance)
  * 3.5 [Design and Implementation](#35-design-and-implementation)
    * 3.5.1 [Installation](#351-installation)
    * 3.5.2 [Distribution](#352-distribution)
    * 3.5.3 [Maintainability](#353-maintainability)
    * 3.5.4 [Reusability](#354-reusability)
    * 3.5.5 [Portability](#355-portability)
    * 3.5.6 [Cost](#356-cost)
    * 3.5.7 [Deadline](#357-deadline)
    * 3.5.8 [Proof of Concept](#358-proof-of-concept)
* 4 [Verification](#4-verification)
* 5 [Appendixes](#5-appendixes)

## Revision History
| Name | Date    | Reason For Changes  | Version   |
| ---- | ------- | ------------------- | --------- |
|Hadi   Rastin|  20/04/2024       | Adding Target Users, User Stories, and data collection                     |           |
|Mohammed     Jameel |  19/05/2024       | Adding product overview, Product Perspective, Machine Learning and Data Analysis, Product Functions and Requirements (functional and Non-functional)                      |           |
|      |         |                     |           |

## 1. Introduction
> This section should provide an overview of the entire document

### 1.1 Document Purpose
Describe the purpose of the SRS and its intended audience.

### 1.2 Product Scope
Identify the product whose software requirements are specified in this document, including the revision or release number. Explain what the product that is covered by this SRS will do, particularly if this SRS describes only part of the system or a single subsystem. Provide a short description of the software being specified and its purpose, including relevant benefits, objectives, and goals. Relate the software to corporate goals or business strategies. If a separate vision and scope document is available, refer to it rather than duplicating its contents here.

### 1.3 Definitions, Acronyms and Abbreviations

### 1.4 References
List any other documents or Web addresses to which this SRS refers. These may include user interface style guides, contracts, standards, system requirements specifications, use case documents, or a vision and scope document. Provide enough information so that the reader could access a copy of each reference, including title, author, version number, date, and source or location.

### 1.5 Document Overview
Describe what the rest of the document contains and how it is organized.

## 2. Product Overview

The DiscountMate project seeks to empower consumers with the ability to make their lives easier by providing reliable information regarding discounted items of interests from various supermarket chains, affording them the opportunity to save potentially hundreds of dollars off their weekly grocery shopping with minimal effort.
Item information is updated regularly through data collection techniques such as web-scraping, prices are then compared between various providers for the same item and those with the highest potential for savings are presented to consumers.

Additionally, the project aims to employ machine learning and data analysis techniques to identify patterns and predict future discount opportunities, providing consumers with relevant recommendations according to their interests and purchase history.
History is obtained through user interaction methods such as item searches, checking off items on a shopping list to indicate a purchase, and scanning purchase receipts by utilizing optical character recognition (OCR) technology and extracting necessary data.

### 2.1 Product Perspective
The DiscountMate project is a new, self-contained product designed to help consumers save money on their grocery shopping by providing them with reliable information on discounted items from various supermarket chains. It is not part of an existing product family, nor is it a replacement for any specific system. Instead, it serves as a unique platform that combines real-time data collection, machine learning, and user interaction to offer users significant savings and a more streamlined shopping experience.

#### 2.1.1 Context and Origin
DiscountMate emerged from the need to provide consumers with accurate and up-to-date information on discounted products across major supermarket chains. With the rising cost of living and the increased use of technology in everyday life, consumers are looking for smarter ways to shop. DiscountMate addresses this need by allowing users to compare prices, view promotions, and create personalized shopping lists that highlight the best deals.

#### 2.1.2 System Overview
DiscountMate is a standalone application that relies on several key components to deliver its functionality:

##### 2.1.2.1 Data Collection and Integration

The application uses web-scraping techniques to collect data from various supermarket chains, ensuring that product information and pricing are kept up-to-date. Data is   then integrated into the system's database, allowing users to access this information for comparison and recommendation purposes.

##### 2.1.2.2  Machine Learning and Data Analysis:

The system employs machine learning algorithms to identify patterns and predict future discount opportunities.
This capability allows DiscountMate to provide personalized product recommendations based on user interactions, such as search history, shopping list modifications, and scanned purchase receipts (using Optical Character Recognition, or OCR).

##### 2.1.2.3  User Interaction and Personalization
Users can create profiles, enabling them to save shopping lists and rate or comment on purchased items.
The application provides various search and recommendation features to help users find discounted products quickly.
The system also offers a mapping function to help users locate nearby stores and navigate to them.

##### 2.1.2.4 External Interfaces and Integration
DiscountMate can interface with external applications such as mapping software to provide location-based services.
It also integrates with user devices for features like scanning purchase receipts using OCR, which extracts data for further analysis.

#### 2.1.3 Component Relationships and Interactions
The following diagram illustrates the major components of the DiscountMate system and their interactions.

**We need a figure here.**

### 2.2 Product Functions

#### 2.2.1 Product Catalog and Pricing. 

Users can browse a comprehensive catalogue of grocery items, view up-to-date product information, compare prices across different supermarket chains, and access current promotions.

#### 2.2.2 Search and Recommendations.

The system provides a search function for finding products by name, brand, price, or promotions, along with auto-suggestions. It also offers personalized product recommendations based on user interactions and machine learning algorithms.
Shopping List Management: Users can create, modify, and manage multiple shopping lists, adding or removing items as needed. The system also allows users to compare prices and total costs across multiple stores.

#### 2.2.3 User Profile and Authentication.

The system requires users to create profiles with unique usernames and secure passwords, ensuring secure access to personalized features and shopping lists.
#### 2.2.4 Feedback and Ratings.

Users can rate and comment on purchased products, providing feedback that contributes to the recommendation engine and helps other users make informed decisions.

#### 2.2.5 Location-Based Services.
The system integrates mapping functionality, enabling users to locate and navigate to nearby supermarkets based on their real-time location.
Customer Support and Interaction: The system offers customer support, allowing users to submit questions or report errors, ensuring a smooth and responsive user experience.

### 2.3 Product Constraints
This subsection should provide a general description of any other items that will limit the developer’s options. These may include:  

* Interfaces to users, other applications or hardware.  
* Quality of service constraints.  
* Standards compliance.  
* Constraints around design or implementation.

### 2.4 User Characteristics
Identify the various user classes that you anticipate will use this product. User classes may be differentiated based on frequency of use, subset of product functions used, technical expertise, security or privilege levels, educational level, or experience. Describe the pertinent characteristics of each user class. Certain requirements may pertain only to certain user classes. Distinguish the most important user classes for this product from those who are less important to satisfy.

### 2.5 Assumptions and Dependencies
List any assumed factors (as opposed to known facts) that could affect the requirements stated in the SRS. These could include third-party or commercial components that you plan to use, issues around the development or operating environment, or constraints. The project could be affected if these assumptions are incorrect, are not shared, or change. Also identify any dependencies the project has on external factors, such as software components that you intend to reuse from another project, unless they are already documented elsewhere (for example, in the vision and scope document or the project plan).

### 2.6 Apportioning of Requirements
Apportion the software requirements to software elements. For requirements that will require implementation over multiple software elements, or when allocation to a software element is initially undefined, this should be so stated. A cross reference table by function and software element should be used to summarize the apportioning.

Identify requirements that may be delayed until future versions of the system (e.g., blocks and/or increments).

## 3. Requirements
> This section specifies the software product's requirements. Specify all of the software requirements to a level of detail sufficient to enable designers to design a software system to satisfy those requirements, and to enable testers to test that the software system satisfies those requirements.

### 3.1 External Interfaces
> This subsection defines all the inputs into and outputs requirements of the software system. Each interface defined may include the following content:
* Name of item
* Source of input or destination of output
* Valid range, accuracy, and/or tolerance
* Units of measure
* Timing
* Relationships to other inputs/outputs
* Screen formats/organization
* Window formats/organization
* Data formats
* Command formats
* End messages

#### 3.1.1 User interfaces
Define the software components for which a user interface is needed. Describe the logical characteristics of each interface between the software product and the users. This may include sample screen images, any GUI standards or product family style guides that are to be followed, screen layout constraints, standard buttons and functions (e.g., help) that will appear on every screen, keyboard shortcuts, error message display standards, and so on. Details of the user interface design should be documented in a separate user interface specification.

Could be further divided into Usability and Convenience requirements.

#### 3.1.2 Hardware interfaces
Describe the logical and physical characteristics of each interface between the software product and the hardware components of the system. This may include the supported device types, the nature of the data and control interactions between the software and the hardware, and communication protocols to be used.

#### 3.1.3 Software interfaces
Describe the connections between this product and other specific software components (name and version), including databases, operating systems, tools, libraries, and integrated commercial components. Identify the data items or messages coming into the system and going out and describe the purpose of each. Describe the services needed and the nature of communications. Refer to documents that describe detailed application programming interface protocols. Identify data that will be shared across software components. If the data sharing mechanism must be implemented in a specific way (for example, use of a global data area in a multitasking operating system), specify this as an implementation constraint.

### 3.2 Functional
#### 3.2.1 Functional Requirement 1 
The system must enable users to view all grocery stores products with up to date catalogue, and all current promotions.

**Rationale**: In order to catch every chance of sales, users should be able to browse all grocery products from catalogue with all the current promotions. This is the key foundation function of the system.

#### 3.2.2  Functional Requirement 2 
The system must enable users to search for products by varying identifiers, included name, brand, price and promotions. 

**Rationale**: Search is a key function for the usage of the system. Users with an idea of their target to buy a product could find out the item quickly from the system. That largely reduces the time users need to find the product from browsing the full product list. 

#### 3.2.3  Functional Requirement 3
The system should auto suggest a list of the recommended product when users types in a product name in the search function.

**Rationale**: The auto suggestion function is part of the recommendation system in the backend which produce recommended product to users based on machine learning algorithm that learned from user shopping habit and shopping transaction records in the system. This function is important in assisting users shopping process.

#### 3.2.4  Functional Requirement 4 

The system must present a search result with the display of a thumbnail of every relevant product together with a brief product description.

**Rationale**: It is very important to provide product image and description for their information on their buying choice.

#### 3.2.5 Functional Requirement 5 

The system must require users to create a profile if they don’t have before they could save their shopping list in the system.  

**Rationale**: Users without this information filled in the system must not be allowed to save any shopping list.

#### 3.2.6  Functional Requirement 6 

The system must require the following detail when the customer creates a profile: a username; a password which must be at least 8 characters in length.

**Rationale**: Users must enter their username and password for their login to the system.

#### 3.2.7  Functional Requirement 7

The system should provide functions for login users to create, to modify, to save and to delete multiple shopping list. The system should allow login users to load the saved shopping list for them to check the individual item price and total shopping list price of multiple grocery stores in the system 

**Rationale**: The function allow users to compare their interested product price of multiple grocery stores in a time saving, regularly basis. It could greatly reduce the tedious work of selecting the same list of products from time to time.

#### 3.2.8 Functional Requirement 8

The system should provide functions for login users to add and to remove multiple items in the shopping list.

**Rationale**: Users could add, remove item in the shopping list according to their need.

#### 3.2.9 Functional Requirement 9

The system should provide rating function for users to give rate and comment to an item. Existing rating and comment of an item is public to all users.

**Rationale**: Users could check the rating and comment for their shopping decision. The system will make use of the rating in the machine learning algorithm to calculate the recommendation item list for each of the user.

#### 3.2.10 Functional Requirement 10

The system should provide a list of recommendation items when user add an item into the shopping list. The list is generated by the machine learning algorithm on the fly. 

**Rationale**: To provide best buying option for users to save money and make better shopping decision.

#### 3.2.11 Functional Requirement 11

The system should provide a map function that use users real time location to search and display the route to get to the nearest Woolworth or Coles stores which is still open at the time.

**Rationale**: Once users compared the price and decision to go one of the grocery store, this function save their time by preventing them leaving the app to open the map routing app separately.

#### 3.2.12 Functional Requirement 12
The system should allow users to report errors or inaccuracies in product information, including incorrect prices, descriptions, or promotions.

**Rationale**: Providing a mechanism for users to report errors helps ensure data accuracy and builds trust with users. It also enables the system to quickly address and correct any discrepancies in the product catalogue.

#### 3.2.13 Functional Requirement 13
The system should allow users to create a wish list of products they intend to purchase in the future.

**Rationale**: A wish list feature enables users to save items for later, helping them remember products they are interested in purchasing when they are ready to shop.

#### 3.2.14 Functional Requirement 14
The system should allow users to rate and review products they have purchased, providing feedback on factors such as quality, value for money, and overall satisfaction.

**Rationale**: Collecting user feedback on purchased items helps improve the quality of product recommendations and provides valuable insights to other users considering the same products. It also offers the system valuable data to refine its recommendation algorithms.

#### 3.2.15 Functional Requirement 15
The system should use user feedback and purchase history to improve personalized product recommendations.

**Rationale**: By incorporating user feedback into the recommendation engine, the system can offer more relevant product suggestions, enhancing the user experience and encouraging more purchases. This approach leverages user-generated data to create a more tailored shopping experience.

#### 3.2.16 Functional Requirement 16
The system should provide users with an option to mark certain products as favorites, indicating a strong preference for use in future recommendations.

**Rationale**: Allowing users to mark products as favorites provides another data point for the recommendation engine, helping to better tailor suggestions based on user preferences. It also gives users a convenient way to quickly find their most-liked products.

### 3.3 Quality of Service
> This section states additional, quality-related property requirements that the functional effects of the software should present.

#### 3.3.1 Performance
If there are performance requirements for the product under various circumstances, state them here and explain their rationale, to help the developers understand the intent and make suitable design choices. Specify the timing relationships for real time systems. Make such requirements as specific as possible. You may need to state performance requirements for individual functional requirements or features.

#### 3.3.2 Security
Specify any requirements regarding security or privacy issues surrounding use of the product or protection of the data used or created by the product. Define any user identity authentication requirements. Refer to any external policies or regulations containing security issues that affect the product. Define any security or privacy certifications that must be satisfied.

#### 3.3.3 Reliability
Specify the factors required to establish the required reliability of the software system at time of delivery.

#### 3.3.4 Availability
Specify the factors required to guarantee a defined availability level for the entire system such as checkpoint, recovery, and restart.

### 3.4 Compliance
Specify the requirements derived from existing standards or regulations, including:  
* Report format
* Data naming
* Accounting procedures
* Audit tracing

For example, this could specify the requirement for software to trace processing activity. Such traces are needed for some applications to meet minimum regulatory or financial standards. An audit trace requirement may, for example, state that all changes to a payroll database shall be recorded in a trace file with before and after values.

### 3.5 Design and Implementation

#### 3.5.1 Installation
Constraints to ensure that the software-to-be will run smoothly on the target implementation platform.

#### 3.5.2 Distribution
Constraints on software components to fit the geographically distributed structure of the host organization, the distribution of data to be processed, or the distribution of devices to be controlled.

#### 3.5.3 Maintainability
Specify attributes of software that relate to the ease of maintenance of the software itself. These may include requirements for certain modularity, interfaces, or complexity limitation. Requirements should not be placed here just because they are thought to be good design practices.

#### 3.5.4 Reusability
<!-- TODO: come up with a description -->

#### 3.5.5 Portability
Specify attributes of software that relate to the ease of porting the software to other host machines and/or operating systems.

#### 3.5.6 Cost
Specify monetary cost of the software product.

#### 3.5.7 Deadline
Specify schedule for delivery of the software product.

#### 3.5.8 Proof of Concept
<!-- TODO: come up with a description -->

## 4. Verification
> This section provides the verification approaches and methods planned to qualify the software. The information items for verification are recommended to be given in a parallel manner with the requirement items in Section 3. The purpose of the verification process is to provide objective evidence that a system or system element fulfills its specified requirements and characteristics.

<!-- TODO: give more guidance, similar to section 3 -->
<!-- ieee 15288:2015 -->

# Target audience

**Table 1**: Target audience of the online conference webs

<table><tbody><tr><th><p>Target Group</p></th><th><p>What wants from the website</p></th><th><p>Why appealing to target group</p></th></tr><tr><td><p>Bargain Hunters</p></td><td><ul><li>lookout for the discounted items</li><li>Look out to find the best deals to maximize the savings on grocery items.</li></ul></td><td><ul><li>Simple and interactive UI</li><li>Comparing the prices between local supermarkets</li><li>Trustworthy website</li><li>Obtain reward points for further discount</li><li>Estimation of the next discounted items suggested by AI</li></ul></td></tr><tr><td><p>Supermarkets</p></td><td><ul><li>Obtain valuable insights into shopper behavior</li></ul></td><td><ul><li>Understand their customers better and tailor their offerings to meet evolving needs and preferences.</li></ul></td></tr></tbody></table>

# User stories

<table><tbody><tr><th><p>Statement</p></th><th><p>Acceptance criteria</p></th><th><p>Priority</p></th></tr><tr><td><p>As a user, I want to search grocery items</p></td><td><ul><li>User should be able to see the results of the search</li><li>The DiscountMate platform should provide a search functionality specifically tailored for finding grocery items and comparing prices.</li><li>Users should be able to enter the name of a grocery item or specific keywords into the search bar to initiate a search query.</li><li>Upon initiating a search, the platform should return relevant results listing various options for the specified grocery item, including different brands, quantities, and prices.</li><li>The search results should display the price of each item from different supermarkets, allowing users to compare prices and identify the best deal.</li><li>Users should have the option to filter search results based on criteria such as price range, brand preference, quantity, and location.</li><li>The platform should provide detailed information for each item in the search results, including product name, brand, quantity, price, and availability.</li><li>Users should be able to view additional details or specifications for each item by clicking on it within the search results.</li><li>Users should have the option to view historical price data for grocery items, allowing them to track price trends and make informed purchasing decisions.</li></ul></td><td><p>Priority: 1</p><p>High priority</p></td></tr><tr><td><p>As a health-conscious shopper, I want to filter my search results based on specific dietary preferences and nutritional criteria, including healthiness, calorie content, and vegetarian options, so that I can make informed decisions about the products I purchase.</p></td><td><ul><li>Given that I am on the search results page of DiscountMate, when I navigate to the filtering options, I should see the following categories: "Healthiness", "Calorie Content", and "Vegetarian".</li><li>When I select the "Healthiness" filter, I should be presented with options such as "Healthy", "Moderate", and "Indulgent", allowing me to refine my search based on the nutritional value of the products.</li><li>Upon choosing the "Calorie Content" filter, I should have the ability to specify a calorie range (e.g., 0-100 calories, 100-200 calories, etc.) to narrow down the search results according to my dietary requirements.</li><li>f I opt for the "Vegetarian" filter, I expect to see a checkbox or toggle switch that, when activated, filters out non-vegetarian products from the search results, ensuring that only vegetarian options are displayed.</li><li>Once I apply the desired filters, the search results should dynamically update to reflect products that meet the selected criteria, providing me with relevant options tailored to my dietary preferences.</li></ul></td><td><p>Priority: 1</p><p>High priority</p></td></tr><tr><td><p>As a user, I want to be able to log in/log up on the website, so I can use the service of the website.</p></td><td><ul><li>The DiscountMate platform should provide a user authentication system that allows users to create accounts, log in, and log out securely.</li><li>Users should have the option to register for a new account by providing their email address, username, and password, or by using a third-party authentication method such as Google or Facebook.</li><li>Upon successful registration, users should receive a confirmation email or notification containing a verification link to activate their account.</li><li>Registered users should be able to log in to the platform using their email address or username and password combination.</li><li>The login page should include a "forgot password" option that allows users to reset their password if they forget it, by sending a password reset link to their registered email address.</li><li>Users should have the ability to log out of their accounts securely, either through a dedicated "log out" button or by clearing session cookies.</li><li>The platform should implement appropriate security measures such as HTTPS encryption, password hashing, and account lockout policies to protect user accounts from unauthorized access and data breaches.</li><li>Upon logging in, users should have access to their personalized dashboard or profile page, where they can manage account settings, view past orders, and access other account-related features.</li><li>The registration link should open a page with a form to be filled.</li></ul></td><td><p>Priority: 1</p><p>High priority</p></td></tr><tr><td><p>As a user, I want to be able to find the top 10 hot deals for grocery items</p></td><td><ul><li>The DiscountMate platform should provide a dedicated section or feature specifically for showcasing the top 10 hot deals on grocery items.</li><li>Users should be able to easily access the top 10 hot deals section from the platform's main navigation menu or homepage.</li><li>The top 10 hot deals section should prominently display a list of the current top deals on grocery items, ranked based on factors such as discount percentage, popularity, and user ratings.</li><li>Each deal listed in the top 10 hot deals section should include detailed information about the discounted grocery item, including its name, brand, original price, discounted price, and savings percentage.</li></ul></td><td><p>Priority: 1</p><p>High priority</p></td></tr><tr><td><p>As a user, I want to be search recipe for meals and click on the ingredient for searching the items.</p></td><td><ul><li>The DiscountMate platform should provide a search functionality specifically tailored for finding recipes for meals.</li><li>Users should be able to enter keywords or specific criteria (e.g., dish name, cuisine type, dietary preferences) into the search bar to initiate a recipe search.</li><li>Upon initiating a recipe search, the platform should return relevant recipe suggestions that match the user's search criteria.</li><li>Each recipe displayed in the search results should include a list of ingredients required to prepare the dish.</li><li>Users should be able to click on individual ingredients within a recipe to initiate a search for those items within the DiscountMate platform.</li><li>Clicking on an ingredient should automatically populate the search bar with the selected ingredient's name and initiate a search query.</li></ul></td><td><p>Priority: 2</p><p>Medium priority</p></td></tr><tr><td><p>As a user, I want to be able to create shopping lists and share with other users.</p></td><td><ul><li>Users should have the ability to create new shopping lists directly within the DiscountMate platform.</li><li>The shopping list creation feature should be easily accessible from the user interface, with intuitive controls for adding, editing, and deleting items.</li><li>Each shopping list should allow users to add multiple items, along with quantity and any additional notes or specifications.</li><li>Users should have the option to categorize items within their shopping lists to facilitate organization and navigation.</li><li>The platform should provide a user-friendly interface for sharing shopping lists with other users, either through direct invitations or by generating shareable links.</li><li>Shared shopping lists should be accessible to invited users with appropriate permissions, allowing them to view, edit, and update the list contents collaboratively.</li></ul></td><td><p>Priority: 2</p><p>Medium priority</p></td></tr><tr><td><p>As a user, I want to see the location of the supermarkets on the map.</p></td><td><ul><li>Upon accessing the DiscountMate platform, I should have the option to view a map displaying the locations of nearby supermarkets.</li><li>The supermarket locations should be accurately marked on the map, with each supermarket represented by a distinct marker or pin.</li><li>Users should be able to interact with the map, including zooming in and out, panning, and toggling between different map views (e.g., satellite view, street view).</li><li>Information displayed for each supermarket marker should include the supermarket name, address, contact information, and any other relevant details.</li></ul></td><td><p>Priority: 2</p><p>Medium priority</p></td></tr><tr><td><p>As a user, I want to sort the searched items based on price and distance to supermarket</p></td><td><ul><li>When I perform a search for items on the DiscountMate platform, I should see an option to sort the results by price.</li><li>Upon selecting the price sorting option, the items should be arranged in ascending order, with the lowest priced items displayed first.</li><li>Additionally, I should have the ability to sort the search results based on the distance to the nearest supermarket.</li><li>Upon selecting the distance sorting option, the items should be arranged in ascending order, with the items closest to the user's current location displayed first.</li></ul></td><td><p>Priority: 2</p><p>Medium priority</p></td></tr><tr><td><p>As a user, I want to receive suggestion about the interested items according to my history of search and purchases</p></td><td><ul><li>The DiscountMate platform should have a recommendation system in place that utilizes user search history and purchase data to generate personalized suggestions.</li><li>Upon logging into the platform, users should be presented with a section dedicated to personalized recommendations based on their search and purchase history.</li><li>The personalized recommendations section should display a list of suggested grocery items that align with the user's interests and preferences, as inferred from their past interactions with the platform.</li><li>The recommendations should be diverse and relevant, covering a range of grocery categories and products that the user has shown interest in previously.</li><li>Users should have the option to provide feedback on the recommendations, such as rating items or indicating whether they find the suggestions helpful.</li><li>The recommendation system should continuously adapt and refine its suggestions based on the user's ongoing interactions and feedback, ensuring that the recommendations remain accurate and up-to-date.</li></ul></td><td><p>Priority: 1</p><p>High priority</p></td></tr><tr><td><p>As a shopper, I want to utilize the barcode scanning feature on DiscountMate so that I can conveniently search for items by scanning their barcode, thereby streamlining the product discovery process.</p></td><td><ul><li>Given that I am on the DiscountMate application, when I navigate to the search functionality, I should see an option to "Scan Barcode" prominently displayed.</li><li>When I select the "Scan Barcode" option, the application should activate the device's camera functionality, allowing me to capture an image of the barcode.</li><li>Upon successfully scanning the barcode, the application should promptly process the image and extract the barcode data accurately.</li><li>Once the barcode data is extracted, the application should automatically initiate a search query based on the scanned barcode, retrieving relevant product information from the database.</li><li>The search results should be displayed to me in a clear and organized manner, presenting details such as product name, description, price, and availability.</li></ul></td><td><p>Priority: 2</p><p>Medium priority</p></td></tr><tr><td><p>As a supermarket marketing manager, I want to analyze customer purchase behavior and preferences to tailor marketing campaigns and promotions effectively.</p></td><td><ul><li>Supermarket marketing managers should be able to create customized customer segments and target specific audience groups with personalized marketing messages and promotions.</li><li>The platform should track individual customer purchase histories and analyze shopping patterns to identify high-value customers, frequent buyers, and churn risks.</li><li>Supermarket marketing managers should have access to customer profiling reports that provide insights into customer demographics, preferences, spending habits, and product affinities.</li><li>The platform should integrate with customer loyalty programs and CRM systems to capture and analyze customer feedback, reviews, and engagement metrics.</li><li>Supermarket marketing managers should be able to measure the effectiveness of marketing campaigns and promotions by tracking metrics such as customer acquisition rates.</li></ul></td><td><p>Priority: 1</p><p>High priority</p></td></tr></tbody></table>

# User Personas

1\. Sarah, the Budget-Conscious Shopper:

- Demographics: Female, 32 years old, married, with two children
- Occupation: Office administrator
- Education: Bachelor's degree in business administration
- Income: Moderate
- Location: Urban area
- Goals and Behaviors:
  - Sarah is always looking for ways to save money on groceries to support her family on a tight budget.
  - She shops at multiple supermarkets to find the best deals and discounts on everyday essentials.
  - Sarah prefers to plan her shopping trips in advance and create shopping lists to stay organized and avoid overspending.
  - She is tech-savvy and relies on mobile apps and websites to compare prices, discover promotions, and redeem coupons.
- Pain Points:
  - Limited time and resources make it challenging for Sarah to visit multiple stores and track the latest deals.
  - She often feels overwhelmed by the sheer volume of options available and struggles to make informed purchasing decisions.

\- Needs and Preferences:

- - Sarah values convenience and efficiency, so she appreciates tools that simplify the shopping experience and help her find the best bargains quickly.
    - Personalized recommendations and alerts for discounts on her favorite products would be helpful for Sarah to save time and money.

2\. David, the Tech-Savvy Urbanite:

- Demographics: Male, 28 years old, single
- Occupation: Software engineer
- Education: Master's degree in computer science
- Income: High
- Location: Urban area
- Goals and Behaviors:
  - David leads a busy lifestyle and relies on technology to streamline his daily routines, including grocery shopping.
  - He enjoys exploring new apps and digital platforms that offer innovative features and solutions to everyday challenges.
  - David prioritizes convenience and efficiency when it comes to shopping and prefers online grocery delivery services for their convenience and time-saving benefits.
  - He is interested in data-driven insights and analytics that can help him make smarter purchasing decisions and optimize his shopping experience.
- Pain Points:
  - David dislikes wasting time browsing through crowded supermarkets and waiting in long checkout lines.
  - He values transparency and authenticity in product information and dislikes being bombarded with irrelevant ads or promotions.

\- Needs and Preferences:

- - David appreciates user-friendly interfaces and intuitive navigation that make it easy to find and compare products, view nutritional information, and place orders seamlessly.
    - Advanced search filters, personalized recommendations, and AI-driven insights would enhance David's shopping experience by providing relevant and timely information tailored to his preferences and lifestyle.

3\. Emily, the Health-Conscious Consumer:

- Demographics: Female, 35 years old, married, no children
- Occupation: Nutritionist
- Education: Doctorate in nutritional science
- Income: Moderate to high
- Location: Suburban area
- Goals and Behaviors:
  - Emily prioritizes health and wellness and is mindful of the nutritional content and quality of the foods she consumes.
  - She prefers to shop at specialty stores and health food markets that offer organic, locally sourced, and sustainable products.
  - Emily enjoys experimenting with new recipes and ingredients and values access to a diverse selection of fresh produce and specialty items.
  - She is interested in learning about the health benefits of different foods and ingredients and seeks out educational resources and articles on nutrition and wellness.
- Pain Points:
  - Emily finds it challenging to find specialty products and ingredients that meet her dietary preferences and restrictions at mainstream supermarkets.
  - She is concerned about the environmental impact of food production and packaging and seeks out eco-friendly alternatives.
- Needs and Preferences:
  - Emily would appreciate a platform that curates a selection of high-quality, organic, and sustainably sourced products from reputable brands and suppliers.
  - Nutritional information, ingredient lists, and certifications (e.g., organic, non-GMO, fair trade) are important factors for Emily when making purchasing decisions.
  - She values community and enjoys connecting with like-minded individuals who share her passion for healthy living and sustainable lifestyles.

# Figma UI/UX for desktop and mobile devices

# <https://www.figma.com/file/949S5eM0QyJdXPF88vDdMJ/Assessment-1-Hadi-Rastin?type=design&node-id=34-19&mode=design&t=mHke9jxhxemPfSFm-0>

# Data collection

This section outlines the data collection practices of DiscountMate, with a focus on the types of data collected, the purposes for which they are collected, and the measures taken to ensure user privacy and data security. The data collection practices are in compliance with data privacy regulations and aim to provide transparency to users regarding the handling of their personal information.

1\. Personal Data:

\- DiscountMate collects users' email addresses during the registration process to create user accounts and facilitate communication.

2\. Usage Data:

- Usage Data collected by DiscountMate may include:
- Internet Protocol (IP) addresses
- Browser type and version
- Pages visited on the DiscountMate website or application
- Date and time of visits
- Time spent on pages
- Unique device identifiers

This information is used to analyze user behavior, improve the user experience, and troubleshoot technical issues.

3\. Information from Third-Party Social Media Services:

DiscountMate allows users to register and log in using third-party social media services such as Google, Facebook, and Twitter. If users choose to register or log in through these services, DiscountMate may collect personal data already associated with their social media accounts, such as name, email address, activities, or contact lists.

4\. Information Collected while Using the Application:

- With user permission, DiscountMate may collect the following information while using the application:
- Location information to provide location-based services
- Pictures and other data from the device's camera and photo library to enable specific features of the application

## 5. Appendixes
