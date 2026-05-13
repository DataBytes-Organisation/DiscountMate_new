const axios = require('axios');

// Analytics Service URL - can be configured via environment variable
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5002';

/**
 * Get sales summary from analytics service
 */
const getSalesSummary = async (req, res) => {
  try {
    const response = await axios.post(
      `${ANALYTICS_SERVICE_URL}/api/analytics/sales-summary`,
      req.body,
      { timeout: 30000 } // 30 second timeout for data processing
    );

    if (response.data.success) {
      return res.json(response.data);
    } else {
      return res.status(500).json({
        success: false,
        message: 'Analytics service returned an error',
        error: response.data.error
      });
    }
  } catch (error) {
    console.error('Error calling analytics service:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'Analytics service is currently unavailable',
        error: 'Service connection failed. Please ensure the Python Analytics service is running on port 5002.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get sales summary',
      error: error.message
    });
  }
};

/**
 * Get brand analysis from analytics service
 */
const getBrandAnalysis = async (req, res) => {
  try {
    const response = await axios.post(
      `${ANALYTICS_SERVICE_URL}/api/analytics/brand-analysis`,
      req.body,
      { timeout: 30000 }
    );

    if (response.data.success) {
      return res.json(response.data);
    } else {
      return res.status(500).json({
        success: false,
        message: 'Analytics service returned an error',
        error: response.data.error
      });
    }
  } catch (error) {
    console.error('Error calling analytics service:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'Analytics service is currently unavailable',
        error: 'Service connection failed.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get brand analysis',
      error: error.message
    });
  }
};

/**
 * Get price comparison from analytics service
 */
const getPriceComparison = async (req, res) => {
  try {
    const response = await axios.post(
      `${ANALYTICS_SERVICE_URL}/api/analytics/price-comparison`,
      req.body,
      { timeout: 30000 }
    );

    if (response.data.success) {
      return res.json(response.data);
    } else {
      return res.status(500).json({
        success: false,
        message: 'Analytics service returned an error',
        error: response.data.error
      });
    }
  } catch (error) {
    console.error('Error calling analytics service:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'Analytics service is currently unavailable',
        error: 'Service connection failed.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get price comparison',
      error: error.message
    });
  }
};

/**
 * Clean transaction data using analytics service
 */
const cleanData = async (req, res) => {
  try {
    const response = await axios.post(
      `${ANALYTICS_SERVICE_URL}/api/analytics/data-cleaning`,
      req.body,
      { timeout: 60000 } // 60 second timeout for data cleaning
    );

    if (response.data.success) {
      return res.json(response.data);
    } else {
      return res.status(500).json({
        success: false,
        message: 'Analytics service returned an error',
        error: response.data.error
      });
    }
  } catch (error) {
    console.error('Error calling analytics service:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'Analytics service is currently unavailable',
        error: 'Service connection failed.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to clean data',
      error: error.message
    });
  }
};

module.exports = {
  getSalesSummary,
  getBrandAnalysis,
  getPriceComparison,
  cleanData
};

