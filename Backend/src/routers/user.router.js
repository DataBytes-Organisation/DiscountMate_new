const express = require('express');
const userController = require('../controllers/user.controller');
const multer = require('multer');
const verifyToken = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');
const { signupValidation, signinValidation } = require('../validators/user.validators');

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype?.startsWith('image/')) {
            cb(null, true);
            return;
        }

        cb(new Error('Only image files are allowed'), false);
    },
});

const router = express.Router();

router.post('/signup', userController.signupLimiter, signupValidation, validateRequest, userController.signup);
router.post('/signin', userController.signinLimiter, signinValidation, validateRequest, userController.signin);

router.get('/profile', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, userController.updateProfile);
router.put('/change-password', verifyToken, userController.changePassword);
router.get('/address-suggestions', verifyToken, userController.getAddressSuggestions);
router.get('/notification-preferences', verifyToken, userController.getNotificationPreferences);
router.put('/notification-preferences', verifyToken, userController.updateNotificationPreferences);
router.get('/dashboard-preferences', verifyToken, userController.getDashboardPreferences);
router.put('/dashboard-preferences', verifyToken, userController.updateDashboardPreferences);
router.get('/subscription', verifyToken, userController.getSubscription);
router.put('/subscription', verifyToken, userController.updateSubscription);
router.delete('/account', verifyToken, userController.deleteAccount);
router.post('/upload-profile-image', verifyToken, upload.single('image'), userController.updateProfileImage);
router.get('/profile-image', verifyToken, userController.getProfileImage);

module.exports = router;
