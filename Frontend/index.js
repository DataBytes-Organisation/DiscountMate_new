const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Use the MONGODB_URI from the environment variables
const uri = process.env.MONGODB_URI;

// Check if the URI is defined
if (!uri) {
  console.error("MongoDB URI not defined. Please set MONGODB_URI in the .env file.");
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB', err));

// Define a schema and model
const productSchema = new mongoose.Schema({
  product_code: Number,
  category: String,
  sub_category_1: String,
  sub_category_2: String,
  product_name: String,
  current_price: Number,
  unit_per_prod: Number,
  measurement: String,
  link: String,
  link_image: String,
});

// Name of the collection in MongoDB
const Product = mongoose.model('Sample_Product_Master', productSchema, 'Sample_Product_Master');

// Root route to avoid 404 error
app.get('/', (req, res) => {
  res.send('Welcome to the DiscountMate API!');
});

// Define an API route to get products from 'Sample_Product_Master'
app.get('/products', async (req, res) => {
  try {
    console.log('Fetching products from MongoDB...');
    const products = await Product.find();
    if (products.length === 0) {
      console.log('No products found');
    } else {
      console.log('Products fetched:', products);
    }
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: error.message });
  }
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
