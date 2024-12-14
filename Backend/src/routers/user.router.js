const express = require('express');
const userController = require('../controllers/user.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'uploads'); // or another directory
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
router.post('/signup', userController.signup);

// Signin route
router.post('/signin', userController.signin);

// Get profile route
router.get('/profile', userController.getProfile);

//Upload image
router.post('/upload-profile-image', upload.single('image'), userController.updateProfileImage);

router.get('/profile-image', userController.getProfileImage);

module.exports = router;