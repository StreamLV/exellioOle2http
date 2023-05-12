const express = require('express');
//const { check } = require('express-validator');

const rootController = require('../controllers/root-controller');

const router = express.Router();

router.get('/', rootController.checkStatus);

module.exports = router;