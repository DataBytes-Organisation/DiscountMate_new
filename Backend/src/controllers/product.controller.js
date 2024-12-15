const { connectToMongoDB, getDb } = require('../config/database'); 

const getProducts = async (req, res) => {
    try {
        // Ensure the database connection is established
        await connectToMongoDB();
        const db = getDb();

        // Fetch all products
        const products = await db.collection('product').find().toArray();
        if (products.length === 0) {
            return res.status(404).json({ message: 'No products found' });
        }

        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Failed to fetch products' });
    }
};
const getProduct = async (req, res) => {
    try {
        await connectToMongoDB();
        const db = getDb();
        const product = await db.product.findOne({ product_id: req.body.productId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        return res.json({
            product_id: product.product_id,
            product_name: product.product_name,
            link_image: product.link_image,
            current_price: product.current_price
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = { getProducts, getProduct };
