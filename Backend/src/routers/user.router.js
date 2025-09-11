const express = require('express');
const userController = require('../controllers/user.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads'); // or another directory
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Ensure unique filenames
    },
});

const upload = multer({ storage: storage });

// Define routes
const router = express.Router();

// Signup route
/**
 * @swagger
 * /users/signup:
 *   post:
 *     tags: [Users]
 *     summary: User signup
 *     description: Create a new user account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "testuser@example.com"
 *               password:
 *                 type: string
 *                 example: "Test@123"
 *               verifyPassword:
 *                 type: string
 *                 example: "Test@123"
 *               user_fname:
 *                 type: string
 *                 example: "John"
 *               user_lname:
 *                 type: string
 *                 example: "Doe"
 *               address:
 *                 type: string
 *                 example: "123 Test Street"
 *               phone_number:
 *                 type: string
 *                 example: "1234567890"
 *               admin:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.post('/signup', userController.signupLimiter, userController.signup); // Signup using limiter

// Signin route
/**
 * @swagger
 * /users/signin:
 *   post:
 *     tags: [Users]
 *     summary: User signin
 *     description: Authenticate a user and return a token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "testuser@example.com"
 *               password:
 *                 type: string
 *                 example: "Test@123"
 *     responses:
 *       200:
 *         description: Signin successful
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post('/signin', userController.signin);

// Get profile route
/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile
 *     description: Retrieve details of the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get('/profile', userController.getProfile);

// Upload profile image
/**
 * @swagger
 * /users/upload-profile-image:
 *   post:
 *     tags: [Users]
 *     summary: Upload profile image
 *     description: Uploads a profile image for the user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile image uploaded successfully
 *       400:
 *         description: No file uploaded
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.post('/upload-profile-image', upload.single('image'), userController.updateProfileImage);

// Get Profile Image
/**
 * @swagger
 * /users/profile-image:
 *   get:
 *     tags: [Users]
 *     summary: Get profile image
 *     description: Retrieve the user's profile image.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile image retrieved successfully
 *       404:
 *         description: Profile image not found
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get('/profile-image', userController.getProfileImage);

module.exports = router;
