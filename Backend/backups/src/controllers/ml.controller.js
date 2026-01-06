const axios = require('axios');

// ML Service URL - can be configured via environment variable
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

/**
 * Get weekly specials from ML service
 */
const getWeeklySpecials = async (req, res) => {
  try {
    const { limit, category } = req.query;

    // Build query parameters
    const params = {};
    if (limit) params.limit = limit;
    if (category) params.category = category;

    // Call Python ML service
    const response = await axios.get(`${ML_SERVICE_URL}/api/weekly-specials`, {
      params,
      timeout: 10000 // 10 second timeout
    });

    if (response.data.success) {
      return res.json(response.data);
    } else {
      return res.status(500).json({
        success: false,
        message: 'ML service returned an error',
        error: response.data.error
      });
    }
  } catch (error) {
    console.error('Error calling ML service:', error.message);

    // If ML service is unavailable, return a fallback response
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'ML service is currently unavailable',
        error: 'Service connection failed. Please ensure the Python ML service is running on port 5001.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly specials',
      error: error.message
    });
  }
};

/**
 * Get product recommendations from ML service
 */
const getRecommendations = async (req, res) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/api/ml/recommendations`,
      req.body,
      { timeout: 15000 }
    );

    if (response.data.success) {
      return res.json(response.data);
    } else {
      return res.status(500).json({
        success: false,
        message: 'ML service returned an error',
        error: response.data.error
      });
    }
  } catch (error) {
    console.error('Error calling ML recommendations service:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'ML service is currently unavailable',
        error: 'Service connection failed.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get recommendations',
      error: error.message
    });
  }
};

/**
 * Get price predictions from ML service
 */
const getPricePrediction = async (req, res) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/api/ml/price-prediction`,
      req.body,
      { timeout: 15000 }
    );

    if (response.data.success) {
      return res.json(response.data);
    } else {
      return res.status(500).json({
        success: false,
        message: 'ML service returned an error',
        error: response.data.error
      });
    }
  } catch (error) {
    console.error('Error calling ML price prediction service:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'ML service is currently unavailable',
        error: 'Service connection failed.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get price prediction',
      error: error.message
    });
  }
};

module.exports = {
  getWeeklySpecials,
  getRecommendations,
  getPricePrediction
};

