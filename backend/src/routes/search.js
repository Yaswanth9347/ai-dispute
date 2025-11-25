const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/SearchController');
const { authenticate } = require('../middleware/auth');

// All search routes require authentication
router.use(authenticate);

// Global search
router.get('/', SearchController.search);

// Search suggestions (autocomplete)
router.get('/suggestions', SearchController.getSuggestions);

module.exports = router;
