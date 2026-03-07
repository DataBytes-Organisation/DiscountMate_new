const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// const { connectToMongoDB } = require('./src/config/database');
const userRoutes = require('./src/routers/user.router');
const productRoutes = require('./src/routers/product.router');
const categoryRoutes = require('./src/routers/category.router');
const blogRoutes = require('./src/routers/blog.router');
const newsRoutes = require('./src/routers/news.router');
const contactRoutes = require('./src/routers/contact.router');
const basketRoutes = require('./src/routers/basket.router');
const mlRoutes = require('./src/routers/ml.router');
const analyticsRoutes = require('./src/routers/analytics.router');

if (process.env.NODE_ENV !== 'production') {
   require('dotenv').config();
}

const setupSwagger = require('./src/config/swagger');

const app = express();
const PORT = process.env.PORT || 8080;

// App Engine / reverse proxy support:
// express-rate-limit validates X-Forwarded-For usage and will throw if proxies are sending the header but Express isn't configured to trust them.
if (process.env.NODE_ENV === 'production') {
    // Trust the first proxy hop (works for App Engine / common ingress setups)
    app.set('trust proxy', 1);
}

const uploadsDir = process.env.UPLOAD_DIR || path.join(os.tmpdir(), "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

// Initialize Swagger
setupSwagger(app);

async function ensureMongoUri() {
   if (process.env.MONGO_URI && process.env.MONGO_URI.trim()) {
      return;
   }

   const secretName = process.env.MONGO_URI_SECRET_NAME || 'mongo-uri';
   const client = new SecretManagerServiceClient();

   // Prefer App Engine-provided project id
   const projectId = process.env.GOOGLE_CLOUD_PROJECT || await client.getProjectId();
   if (!projectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT is not set and projectId could not be resolved");
   }

   const secretVersionName = `projects/${projectId}/secrets/${secretName}/versions/latest`;

   const [version] = await client.accessSecretVersion({ name: secretVersionName });
   const payload = version.payload && version.payload.data
      ? version.payload.data.toString('utf8').trim()
      : '';

   if (!payload) {
      throw new Error(`Secret ${secretName} is empty or unreadable`);
   }

   process.env.MONGO_URI = payload;

   console.log("MONGO_URI loaded:", Boolean(process.env.MONGO_URI));
}

async function ensureJwtSecret() {
   if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) {
      return;
   }

   const secretName = process.env.JWT_SECRET_SECRET_NAME || "jwt-secret";
   const client = new SecretManagerServiceClient();

   // Prefer App Engine-provided project id
   const projectId = process.env.GOOGLE_CLOUD_PROJECT || (await client.getProjectId());
   if (!projectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT is not set and projectId could not be resolved");
   }

   const secretVersionName = `projects/${projectId}/secrets/${secretName}/versions/latest`;
   const [version] = await client.accessSecretVersion({ name: secretVersionName });

   const payload =
      version.payload && version.payload.data
         ? version.payload.data.toString("utf8").trim()
         : "";

   if (!payload) {
      throw new Error(`Secret ${secretName} is empty or unreadable`);
   }

   process.env.JWT_SECRET = payload;
   console.log("JWT_SECRET loaded:", Boolean(process.env.JWT_SECRET));
}

async function startServer() {
   try {
      await ensureJwtSecret();
      await ensureMongoUri();

      // Require AFTER MONGO_URI is set
      const { connectToMongoDB } = require('./src/config/database');
      await connectToMongoDB();
   } catch (err) {
      console.error("Failed to initialize MongoDB:", err);
      process.exit(1);
   }

   app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
   });
}

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
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
startServer();
