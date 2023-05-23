const express = require('express');
//const { check } = require('express-validator');

const exellioController = require('../controllers/exellio-controller');

const router = express.Router();

//api
router.get('/', exellioController.sendCommandInfo);
router.post('/sendcommand', exellioController.sendCommand);

module.exports = router;