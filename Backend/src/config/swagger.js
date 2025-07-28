const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const path = require("path");
require('dotenv').config()
const BASE_URL = process.env.BASE_URL;


const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "DiscountMate API",
            version: "1.0.0",
            description: "API documentation for DiscountMate backend",
        },
        servers: [
            {
                url: `${BASE_URL}/api`,
            },
        ],
        tags: [
            { name: "Basket", description: "API endpoints related to basket" },
            { name: "Blogs", description: "API endpoints related to blogs" },
            { name: "ContactForm", description: "API endpoints related to contact form" },
            { name: "News", description: "API endpoints related to news" },
            { name: "Products", description: "API endpoints related to products" },
            { name: "Users", description: "API endpoints related to user management" },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Enter your token in the format: Bearer <your-token>",
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: [path.resolve(__dirname, "../routers/*.js")], // Fixed path
};

const swaggerSpec = swaggerJsdoc(options);

const setupSwagger = (app) => {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log(`Swagger docs available at ${BASE_URL}/api-docs`);
};

module.exports = setupSwagger;
