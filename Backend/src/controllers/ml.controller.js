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

/* ============================================================
 * Recipe RAG proxy handlers
 * ============================================================
 * Each function below forwards a request from Express to the
 * Python Flask service. They are thin "pass-through" handlers:
 *   1. Read what the browser sent (req.body / req.query)
 *   2. Call the matching Python endpoint via axios
 *   3. Send Python's response straight back to the browser
 *
 * Layman: "Take the message from the website, walk it down the
 *          hallway to the Python team, bring back what they say."
 * Technical: API gateway pattern. Express handles transport,
 *            auth (when added), and CORS; Python owns ML logic.
 */

/**
 * GET /api/ml/recipe/stats
 * Forwards to Flask GET /api/recipe/stats (diagnostic info)
 */
const getRecipeStats = async (req, res) => {
  try {
    const response = await axios.get(
      `${ML_SERVICE_URL}/api/recipe/stats`,
      { timeout: 5000 }
    );
    return res.json(response.data);
  } catch (error) {
    console.error('Error calling recipe stats:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'ML service is currently unavailable',
        error: 'Recipe service is not running on port 5001.'
      });
    }
    // Forward Flask's error response if it sent one (e.g. 503 RAG_NOT_READY)
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recipe stats',
      error: error.message
    });
  }
};

/**
 * GET /api/ml/recipe/search?q=...&top_k=...
 * Forwards to Flask GET /api/recipe/search (retrieval only, no LLM)
 */
const getRecipeSearch = async (req, res) => {
  try {
    const response = await axios.get(
      `${ML_SERVICE_URL}/api/recipe/search`,
      {
        params: req.query,   // forward all query params (?q=, ?top_k=)
        timeout: 10000
      }
    );
    return res.json(response.data);
  } catch (error) {
    console.error('Error calling recipe search:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'ML service is currently unavailable',
        error: 'Recipe service is not running on port 5001.'
      });
    }
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({
      success: false,
      message: 'Recipe search failed',
      error: error.message
    });
  }
};

/**
 * POST /api/ml/recipe/chat
 * Forwards to Flask POST /api/recipe/chat (full RAG, slow)
 *
 * Note the longer timeout (200s). The LLM cascade can take 5-15s normally,
 * up to ~200s if the first model in the cascade is slow and we have to
 * fall through to the next provider. 200s gives generous headroom without
 * letting genuinely-stuck requests hang forever.
 */
const postRecipeChat = async (req, res) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/api/recipe/chat`,
      req.body,                 // forward the JSON body verbatim
      { timeout: 200000 }        // 200 seconds
    );
    return res.json(response.data);
  } catch (error) {
    console.error('Error calling recipe chat:', error.message);
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'ML service is currently unavailable',
        error: 'Recipe service is not running on port 5001.'
      });
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        message: 'Recipe chat timed out',
        error: 'All LLM providers were too slow to respond. Please retry.'
      });
    }
    // Pass Flask's structured error response straight through
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({
      success: false,
      message: 'Recipe chat failed',
      error: error.message
    });
  }
};

/**
 * POST /api/ml/recipe/reset
 * Forwards to Flask POST /api/recipe/reset (clears one session)
 */
const postRecipeReset = async (req, res) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/api/recipe/reset`,
      req.body,
      { timeout: 5000 }
    );
    return res.json(response.data);
  } catch (error) {
    console.error('Error calling recipe reset:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'ML service is currently unavailable'
      });
    }
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({
      success: false,
      message: 'Recipe reset failed',
      error: error.message
    });
  }
};


/**
 * GET /api/ml/recipe/products?context_id=...
 * Forwards to Flask GET /api/recipe/products — fetches MongoDB product cards
 * for a completed chat turn. Called after /chat returns products_pending=true.
 */
const getRecipeProducts = async (req, res) => {
  try {
    const response = await axios.get(
      `${ML_SERVICE_URL}/api/recipe/products`,
      {
        params: req.query,   // forwards ?context_id=...
        timeout: 15000
      }
    );
    return res.json(response.data);
  } catch (error) {
    console.error('Error calling recipe products:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'ML service is currently unavailable',
        error: 'Recipe service is not running on port 5001.'
      });
    }
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({
      success: false,
      message: 'Recipe products fetch failed',
      error: error.message
    });
  }
};


module.exports = {
  getWeeklySpecials,
  getRecommendations,
  getPricePrediction,
  // Recipe RAG
  getRecipeStats,
  getRecipeSearch,
  postRecipeChat,
  postRecipeReset,
  getRecipeProducts,
};

