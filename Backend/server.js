const express = require('express');
const cors = require('cors');
const { connectToMongoDB } = require('./src/config/database');
const userRoutes = require('./src/routers/user.router');
const productRoutes = require('./src/routers/product.router');
const blogRoutes = require('./src/routers/blog.router');
const newsRoutes = require('./src/routers/news.router');
const contactRoutes = require('./src/routers/contact.router');
const basketRoutes = require('./src/routers/basket.router');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const setupSwagger = require('./src/config/swagger');

const app = express();
const PORT = process.env.PORT || 3001; // default for local testing

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

// Request logging middleware (structured logs + request id)
const requestLogger = require('./src/middleware/logging.middleware');
app.use(requestLogger);

// Mongoose audit plugin for schemas (best-effort; safe to require even if mongoose isn't used here)
try {
    const mongooseAudit = require('./src/config/mongooseAudit');
    const mongoose = require('mongoose');
    mongoose.plugin(mongooseAudit);
    console.log('Mongoose audit plugin applied');
} catch (e) {
    // non-fatal; mongoose might not be loaded in this process
}

// Initialize Swagger
setupSwagger(app);

// Connect to MongoDB with error handling
if (process.env.MONGO_URI) {
    connectToMongoDB().catch(err => {
        console.error("Failed to connect to MongoDB:", err);
        process.exit(1);
    });
} else if (process.env.ALLOW_START_WITHOUT_DB === 'true') {
    console.warn('MONGO_URI not set; starting without database (ALLOW_START_WITHOUT_DB=true)');
} else {
    console.warn('MONGO_URI not set. To start without DB for demo use ALLOW_START_WITHOUT_DB=true');
}


// API Versioning: mount all routes under /api/v1 to make versioning explicit
const apiV1 = express.Router();
apiV1.use('/users', userRoutes);
apiV1.use('/products', productRoutes);
apiV1.use('/baskets', basketRoutes);
apiV1.use('/blogs', blogRoutes);
apiV1.use('/news', newsRoutes);
apiV1.use('/contact', contactRoutes);

app.use('/api/v1', apiV1);

// Generic /api root: tell clients to use /api/v1 (only exact /api)
app.get('/api', (req, res) => {
    res.set('Deprecation', 'true');
    res.set('Link', '</api/v1>; rel="latest-version"');
    res.status(400).json({ message: 'Please use /api/v1 for current API. This /api root will be removed in future.' });
});

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the DiscountMate API!');
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server and handle listen errors (e.g., port already in use)
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Kill the process using that port or set PORT to a different value.`);
        process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});
