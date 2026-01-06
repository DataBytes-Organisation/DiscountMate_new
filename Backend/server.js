const express = require('express');
const cors = require('cors');
const { connectToMongoDB } = require('./src/config/database');
const userRoutes = require('./src/routers/user.router');
const productRoutes = require('./src/routers/product.router');
const blogRoutes = require('./src/routers/blog.router');
const newsRoutes = require('./src/routers/news.router');
const contactRoutes = require('./src/routers/contact.router');
const basketRoutes = require('./src/routers/basket.router');
const mlRoutes = require('./src/routers/ml.router');
const analyticsRoutes = require('./src/routers/analytics.router');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const setupSwagger = require('./src/config/swagger');

const app = express();
const PORT = process.env.PORT;

const helmet =require('helmet');
// Use Helmet to set security headers including Content Security Policy
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            imgSrc: ["'self'", "data:"],
            styleSrc: ["'self'", "https:"]
        }
    }
}));

// CORS Configuration
app.use(cors({
    origin: "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Ensure 'uploads' directory exists
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

// Initialize Swagger
setupSwagger(app);

// Connect to MongoDB with error handling
connectToMongoDB().catch(err => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/baskets', basketRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the DiscountMate API!');
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
