/*
 * Main server configuration for the DiscountMate backend.
 *
 * This file creates and configures the Express server, loads environment
 * variables, connects to MongoDB and starts supporting services such as
 * the reverse image search service.
 *
 * It also applies the main backend security controls, including security
 * headers, trusted CORS origins, request payload limits, input sanitisation,
 * proxy configuration and central error handling.
 *
 * The server supports local development and managed cloud environments.
 * Sensitive values such as the MongoDB connection string and JWT secret
 * are loaded from environment variables or Google Cloud Secret Manager.
 */

// Import Express to create the DiscountMate backend server.
const express = require('express');

// Import CORS to control which frontend domains can access the API.
const cors = require('cors');

// Import Helmet to add security-related HTTP response headers.
const helmet = require('helmet');

const os = require('os');
const path = require('path');
const fs = require('fs');

// Import the central security logger for CS-15-T3.
const {
   logSecurityEvent,
} = require('./src/utils/securityLogger');

const {
   SecretManagerServiceClient,
} = require('@google-cloud/secret-manager');

// Import DiscountMate application routes.
const userRoutes = require('./src/routers/user.router');
const productRoutes = require('./src/routers/product.router');
const categoryRoutes = require('./src/routers/category.router');
const blogRoutes = require('./src/routers/blog.router');
const newsRoutes = require('./src/routers/news.router');
const contactRoutes = require('./src/routers/contact.router');
const basketRoutes = require('./src/routers/basket.router');
const shoppingListRoutes = require('./src/routers/shopping-list.router');
const mlRoutes = require('./src/routers/ml.router');
const analyticsRoutes = require('./src/routers/analytics.router');

const reverseImageSearchRoutes = require(
   './src/routers/reverse-image-search.router'
);

const dashboardRoutes = require('./src/routers/dashboard.router');
const notificationRoutes = require('./src/routers/notification.router');
const alertSegmentRoutes = require('./src/routers/alertSegment.router');
const listRoutes = require('./src/routers/list.router');

// Import the global input sanitisation middleware added for CS-10-T1.
const inputSanitisation = require(
   './src/middleware/inputSanitisation.middleware'
);

// Import reverse image search service controls.
const {
   startReverseImageSearch,
   stopReverseImageSearch,
} = require('./src/services/reverseImageSearchProcess');

/*
 * Load local environment variables when the application is not running
 * in production. Production values are supplied by the cloud environment.
 */
if (process.env.NODE_ENV !== 'production') {
   require('dotenv').config({
      path: path.join(__dirname, '.env'),
   });
}

// Import the Swagger configuration after environment variables are loaded.
const setupSwagger = require('./src/config/swagger');

// Create the Express application.
const app = express();

/*
 * Remove the default "X-Powered-By: Express" response header.
 *
 * This prevents the backend from unnecessarily revealing the framework
 * it uses and reduces technology information exposure.
 */
app.disable('x-powered-by');

// Use the configured port or fall back to port 8080.
const PORT = process.env.PORT || 8080;

// Detect managed environments such as Google Cloud Run or App Engine.
const isManagedCloudRuntime = Boolean(
   process.env.K_SERVICE || process.env.GAE_SERVICE
);

// Treat Google Cloud deployments as production.
const isProduction =
   process.env.NODE_ENV === 'production' ||
   isManagedCloudRuntime;

/*
 * CS-10-T3: Read the trusted frontend origins from the environment.
 *
 * Multiple trusted frontend origins can be entered in CORS_ORIGIN by
 * separating them with commas.
 *
 * Example:
 * CORS_ORIGIN=http://localhost:8081,https://discountmate.example.com
 */
const allowedOrigins = (process.env.CORS_ORIGIN || '')
   .split(',')
   .map((origin) => origin.trim())
   .filter(Boolean);

/*
 * Prevent the production server from starting without a trusted frontend.
 *
 * This avoids accidentally deploying the backend with an empty or open
 * CORS configuration.
 */
if (isProduction && allowedOrigins.length === 0) {
   throw new Error(
      'CORS_ORIGIN must contain at least one trusted frontend origin in production.'
   );
}

/*
 * CS-10-T3: Check whether an incoming browser request comes from a
 * trusted frontend origin.
 */
function validateCorsOrigin(origin, callback) {
   /*
    * Allow requests that do not contain an Origin header.
    *
    * These requests may come from Postman, curl, a mobile application,
    * another backend service or a server health check rather than a browser.
    */
   if (!origin) {
      return callback(null, true);
   }

   /*
    * Allow the request when the browser origin exactly matches one of the
    * trusted origins configured in CORS_ORIGIN.
    */
   if (allowedOrigins.includes(origin)) {
      return callback(null, true);
   }

   /*
    * Create a specific error for browser requests from untrusted origins.
    *
    * The global error handler converts this error into a controlled
    * 403 Forbidden response.
    */
   const corsError = new Error('Origin not allowed by CORS');
   corsError.code = 'CORS_NOT_ALLOWED';

   return callback(corsError);
}

/*
 * Enable reverse proxy support in production.
 *
 * Managed environments commonly send traffic through a trusted proxy.
 * This allows Express and rate-limiting middleware to identify the
 * correct client IP address.
 */
if (isProduction) {
   // Trust the first proxy hop used by App Engine or Cloud Run.
   app.set('trust proxy', 1);
}

/*
 * Create the temporary uploads directory if it does not already exist.
 */
const uploadsDir =
   process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
   fs.mkdirSync(uploadsDir, {
      recursive: true,
   });
}

/*
 * CS-10-T2: Configure strict security headers for normal API responses.
 *
 * Most DiscountMate API endpoints return JSON rather than HTML pages.
 * Scripts, forms, frames and embedded objects can therefore be blocked.
 */
const apiSecurityHeaders = helmet({
   /*
    * Configure a restrictive Content Security Policy.
    *
    * This reduces the risk of API responses being treated as executable
    * web content by a browser.
    */
   contentSecurityPolicy: {
      /*
       * Disable Helmet's default CSP so the application uses only the
       * policies explicitly defined below.
       */
      useDefaults: false,

      directives: {
         // Block all content types unless specifically permitted.
         defaultSrc: ["'none'"],

         // Prevent an attacker from changing the document base URL.
         baseUri: ["'none'"],

         // Prevent API responses from submitting browser forms.
         formAction: ["'none'"],

         /*
          * Prevent API responses from being placed inside frames or iframes.
          * This helps reduce clickjacking exposure.
          */
         frameAncestors: ["'none'"],

         // Prevent embedded browser plugins and objects.
         objectSrc: ["'none'"],
      },
   },

   /*
    * Prevent browsers from sending referrer information.
    *
    * This reduces the chance of sensitive URL information being shared
    * with another website.
    */
   referrerPolicy: {
      policy: 'no-referrer',
   },

   /*
    * Enable HTTP Strict Transport Security only in production.
    *
    * HSTS instructs browsers to use HTTPS for future connections.
    * It remains disabled locally because development normally uses HTTP.
    */
   strictTransportSecurity: isProduction
      ? {
           // Require HTTPS for one year.
           maxAge: 31536000,

           // Apply the HTTPS requirement to subdomains.
           includeSubDomains: true,
        }
      : false,

   /*
    * Allow uploaded images and other public resources to be displayed
    * by the separate DiscountMate frontend.
    */
   crossOriginResourcePolicy: {
      policy: 'cross-origin',
   },
});

/*
 * Configure separate security headers for Swagger documentation.
 *
 * Swagger UI requires JavaScript and CSS to display the API documentation.
 * The strict API Content Security Policy could otherwise prevent it from
 * loading correctly.
 */
const swaggerSecurityHeaders = helmet({
   /*
    * Disable CSP only for Swagger so its scripts and styles can load.
    * Other Helmet security headers remain enabled.
    */
   contentSecurityPolicy: false,

   // Prevent Swagger pages from sharing referrer information.
   referrerPolicy: {
      policy: 'no-referrer',
   },

   // Enable HTTPS enforcement for Swagger only in production.
   strictTransportSecurity: isProduction
      ? {
           // Require HTTPS for one year.
           maxAge: 31536000,

           // Apply the HTTPS requirement to subdomains.
           includeSubDomains: true,
        }
      : false,

   /*
    * Allow Swagger to load required resources across origins where needed.
    */
   crossOriginResourcePolicy: {
      policy: 'cross-origin',
   },
});

/*
 * Apply Swagger-compatible headers to API documentation requests.
 *
 * All other backend routes receive the stricter API security headers.
 */
app.use((req, res, next) => {
   // Check whether the request is for the Swagger documentation.
   if (req.path.startsWith('/api-docs')) {
      // Apply the Swagger-compatible security configuration.
      return swaggerSecurityHeaders(req, res, next);
   }

   // Apply strict security headers to normal API requests.
   return apiSecurityHeaders(req, res, next);
});

/*
 * CS-10-T3: Configure the trusted-domain CORS policy.
 */
const corsOptions = {
   /*
    * Check every browser request origin against the trusted origin list.
    */
   origin: validateCorsOrigin,

   /*
    * Allow only the HTTP request methods required by DiscountMate.
    */
   methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
   ],

   /*
    * Allow only the request headers required by the frontend.
    *
    * Content-Type is used for JSON data and Authorization is used when
    * the frontend sends JWT access tokens.
    */
   allowedHeaders: [
      'Content-Type',
      'Authorization',
   ],

   /*
    * Allow authenticated cross-origin requests.
    *
    * This can support cookies or other browser credentials when required.
    * Exact trusted origins are used instead of a wildcard origin.
    */
   credentials: true,

   /*
    * Allow browsers to cache successful preflight results for ten minutes.
    *
    * This reduces repeated OPTIONS requests while still allowing CORS
    * configuration changes to take effect within a reasonable period.
    */
   maxAge: 600,

   /*
    * Return the standard successful status for browser preflight requests.
    */
   optionsSuccessStatus: 204,
};

// Apply the trusted CORS policy before body parsing and API routes.
app.use(cors(corsOptions));

/*
 * CS-10-T1: Request payload limits can be changed using environment
 * variables without changing the application code.
 */
const JSON_BODY_LIMIT =
   process.env.JSON_BODY_LIMIT || '100kb';

const FORM_BODY_LIMIT =
   process.env.FORM_BODY_LIMIT || '50kb';

/*
 * Limit incoming JSON request bodies.
 *
 * This helps prevent oversized payload attacks that could consume server
 * memory and processing resources.
 */
app.use(
   express.json({
      // Reject JSON bodies larger than the configured limit.
      limit: JSON_BODY_LIMIT,

      // Only accept JSON objects and arrays as JSON request bodies.
      strict: true,
   })
);

/*
 * Limit URL-encoded form submissions.
 *
 * This restricts the total size, number of parameters and nesting depth
 * accepted by the server.
 */
app.use(
   express.urlencoded({
      // Allow nested form data while restricting its maximum depth.
      extended: true,

      // Reject form bodies larger than the configured limit.
      limit: FORM_BODY_LIMIT,

      // Restrict the total number of submitted form parameters.
      parameterLimit: 100,

      // Prevent excessively deep nested form structures.
      depth: 5,
   })
);

/*
 * Inspect request bodies and query strings for unsafe input.
 *
 * This middleware runs after body parsing but before application routes,
 * ensuring dangerous input is blocked before reaching controllers.
 */
app.use(inputSanitisation);

/*
 * Make files in the temporary uploads directory publicly accessible
 * through the /uploads route.
 */
app.use('/uploads', express.static(uploadsDir));

/*
 * CS-15-T2: Disable Swagger documentation in production.
 *
 * Swagger remains available during local development,
 * but is not exposed on the deployed production backend.
 */
if (!isProduction) {
   setupSwagger(app);
}
/*
 * Load the MongoDB connection string.
 *
 * A locally configured MONGO_URI is used first. If it is unavailable,
 * the value is retrieved from Google Cloud Secret Manager.
 */
async function ensureMongoUri() {
   // Stop if MONGO_URI has already been configured.
   if (process.env.MONGO_URI && process.env.MONGO_URI.trim()) {
      return;
   }

   const secretName =
      process.env.MONGO_URI_SECRET_NAME || 'mongo-uri';

   const client = new SecretManagerServiceClient();

   // Prefer the project ID supplied by the managed cloud environment.
   const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      (await client.getProjectId());

   if (!projectId) {
      throw new Error(
         'GOOGLE_CLOUD_PROJECT is not set and projectId could not be resolved'
      );
   }

   const secretVersionName =
      `projects/${projectId}/secrets/${secretName}/versions/latest`;

   const [version] = await client.accessSecretVersion({
      name: secretVersionName,
   });

   const payload =
      version.payload && version.payload.data
         ? version.payload.data.toString('utf8').trim()
         : '';

   if (!payload) {
      throw new Error(
         `Secret ${secretName} is empty or unreadable`
      );
   }

   // Store the retrieved secret for the database connection module.
   process.env.MONGO_URI = payload;

   // Log only whether the secret was loaded, not the secret itself.
   console.log(
      'MONGO_URI loaded:',
      Boolean(process.env.MONGO_URI)
   );
}

/*
 * Load the JWT signing secret.
 *
 * A locally configured JWT_SECRET is used first. If it is unavailable,
 * the value is retrieved from Google Cloud Secret Manager.
 */
async function ensureJwtSecret() {
   // Stop if JWT_SECRET has already been configured.
   if (
      process.env.JWT_SECRET &&
      process.env.JWT_SECRET.trim()
   ) {
      return;
   }

   const secretName =
      process.env.JWT_SECRET_SECRET_NAME || 'jwt-secret';

   const client = new SecretManagerServiceClient();

   // Prefer the project ID supplied by the managed cloud environment.
   const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      (await client.getProjectId());

   if (!projectId) {
      throw new Error(
         'GOOGLE_CLOUD_PROJECT is not set and projectId could not be resolved'
      );
   }

   const secretVersionName =
      `projects/${projectId}/secrets/${secretName}/versions/latest`;

   const [version] = await client.accessSecretVersion({
      name: secretVersionName,
   });

   const payload =
      version.payload && version.payload.data
         ? version.payload.data.toString('utf8').trim()
         : '';

   if (!payload) {
      throw new Error(
         `Secret ${secretName} is empty or unreadable`
      );
   }

   // Store the retrieved secret for authentication middleware.
   process.env.JWT_SECRET = payload;

   // Log only whether the secret was loaded, not the secret itself.
   console.log(
      'JWT_SECRET loaded:',
      Boolean(process.env.JWT_SECRET)
   );
}

/*
 * Connect to required services before starting the HTTP server.
 */
async function startServer() {
   try {
      // Load authentication and database secrets.
      await ensureJwtSecret();
      await ensureMongoUri();

      /*
       * Import the database module only after MONGO_URI has been loaded.
       */
      const {
         connectToMongoDB,
      } = require('./src/config/database');

      // Connect the DiscountMate backend to MongoDB.
      await connectToMongoDB();
   } catch (err) {
      console.error(
         'Failed to initialize MongoDB:',
         err
      );

      process.exit(1);
   }

   try {
      /*
       * Managed cloud environments use the separately deployed reverse
       * image search service.
       */
      if (isManagedCloudRuntime) {
         console.log(
            'Managed runtime detected. Using reverse image search sidecar via REVERSE_IMAGE_SEARCH_SERVICE_URL.'
         );
      } else {
         /*
          * Start the local reverse image search service during local
          * development.
          */
         await startReverseImageSearch();
      }
   } catch (err) {
      console.error(
         'Failed to start ReverseImageSearch sidecar:',
         err.message
      );

      process.exit(1);
   }

   // Start accepting incoming HTTP requests.
   app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
   });
}

/*
 * DiscountMate API routes.
 */
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/baskets', basketRoutes);
app.use('/api/shopping-lists', shoppingListRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(
   '/api/reverse-image-search',
   reverseImageSearchRoutes
);

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/alert-segments', alertSegmentRoutes);
app.use('/api/lists', listRoutes);

/*
 * Root route used to confirm that the API is running.
 */
app.get('/', (req, res) => {
   res.send('Welcome to the DiscountMate API!');
});
/*
 * CS-15-T1: Handle requests to unknown routes without
 * exposing internal application information.
 */
app.use((req, res) => {
   return res.status(404).json({
      success: false,
      message: 'Resource not found.',
   });
});


/*
 * Global error handling middleware.
 *
 * This must remain after all application routes so it can handle errors
 * passed from middleware, parsers, controllers and route handlers.
 */
app.use((err, req, res, next) => {
   /*
    * CS-10-T3: Handle requests from browser origins that are not included
    * in the trusted DiscountMate frontend allowlist.
    */
   if (err.code === 'CORS_NOT_ALLOWED') {
      logSecurityEvent({
         event: 'CORS_REJECTED',
         ip: req.ip,
         method: req.method,
         route: req.originalUrl,
         details: {
            origin: req.get('Origin'),
         },
      });

      return res.status(403).json({
         success: false,
         message:
            'This origin is not permitted to access the API.',
      });
   }

   /*
    * Handle oversized JSON and URL-encoded form payloads.
    */
   if (
      err.type === 'entity.too.large' ||
      err.type === 'parameters.too.many' ||
      err.status === 413
   ) {
      logSecurityEvent({
         event: 'OVERSIZED_PAYLOAD_BLOCKED',
         ip: req.ip,
         method: req.method,
         route: req.originalUrl,
      });

      return res.status(413).json({
         success: false,
         message: 'Request payload is too large.',
      });
   }

   /*
    * Handle files that exceed the upload limit configured by Multer.
    */
   if (err.code === 'LIMIT_FILE_SIZE') {
      logSecurityEvent({
         event: 'OVERSIZED_FILE_BLOCKED',
         ip: req.ip,
         method: req.method,
         route: req.originalUrl,
      });

      return res.status(413).json({
         success: false,
         message: 'Uploaded file is too large.',
      });
   }

   /*
    * Handle malformed JSON without returning a generic server error.
    */
   if (err.type === 'entity.parse.failed') {
      logSecurityEvent({
         event: 'MALFORMED_JSON_BLOCKED',
         ip: req.ip,
         method: req.method,
         route: req.originalUrl,
      });

      return res.status(400).json({
         success: false,
         message: 'Invalid JSON request.',
      });
   }

   /*
    * Handle URL-encoded form data that exceeds the allowed nesting depth.
    */
   if (
      err.type === 'querystring.parse.rangeError' ||
      (
         err.status === 400 &&
         err.message === 'The input exceeded the depth'
      )
   ) {
      logSecurityEvent({
         event: 'EXCESSIVE_NESTING_BLOCKED',
         ip: req.ip,
         method: req.method,
         route: req.originalUrl,
      });

      return res.status(400).json({
         success: false,
         message:
            'Request payload is nested too deeply.',
      });
   }

   /*
    * CS-15-T1: Log full unexpected error details internally.
    *
    * Detailed error information is kept in server logs and
    * is not returned to the client.
    */
   logSecurityEvent({
      event: 'UNEXPECTED_SERVER_ERROR',
      ip: req.ip,
      method: req.method,
      route: req.originalUrl,
      details: {
         message: err.message,
         stack: err.stack,
      },
   });

   return res.status(500).json({
      success: false,
      message: 'Internal server error.',
   });
});


// Start the DiscountMate backend server.
startServer();

/*
 * Gracefully stop the locally managed reverse image search service when
 * the application receives a shutdown signal.
 */
function shutdown(signal) {
   console.log(
      `Received ${signal}. Shutting down...`
   );

   stopReverseImageSearch();
   process.exit(0);
}

// Handle Ctrl+C and system termination signals.
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
