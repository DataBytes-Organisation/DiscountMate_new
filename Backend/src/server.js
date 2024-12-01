const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { connectToMongoDB } = require('./config/database');
const userRoutes = require('./routers/user.router');
const productRoutes = require('./routers/product.router');
const blogRoutes = require('./routers/blog.router');
const newsRoutes = require('./routers/news.router');
const contactRoutes = require('./routers/contact.router');
const basketRoutes = require('./routers/basket.router');
const path = require('path');
const fs = require('fs');


const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
    origin: "*",
    methods: 'GET,POST,PUT,DELETE',
    credentials: true
}));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });  
}

app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
connectToMongoDB()

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/baskets', basketRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/contact', contactRoutes);


// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the DiscountMate API!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


