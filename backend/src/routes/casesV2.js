// Enhanced Case Routes - New comprehensive case management API
const express = require('express');
const router = express.Router();
const CaseController = require('../controllers/CaseController');

// Case CRUD operations
router.get('/', CaseController.getCases);
router.post('/', CaseController.createCase);
router.get('/:id', CaseController.getCaseById);
router.put('/:id', CaseController.updateCase);

// Case workflow operations
router.post('/:id/progress', CaseController.progressCase);
router.post('/:id/parties', CaseController.addParty);

// Dashboard
router.get('/dashboard/stats', CaseController.getDashboardStats);

module.exports = router;