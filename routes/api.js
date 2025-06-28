const express = require('express');
const { registerStock, getStockHistory } = require('../controllers/stockController');
const { registerUser, takeLoan } = require('../controllers/userController');
const { buyStock, sellStock } = require('../controllers/tradingController');
const { getUserReport, getStockReport, getTopUsers, getTopStocks } = require('../controllers/reportController'); // <--- ADD THIS LINE

const router = express.Router();

// Stock Management Routes
router.route('/stocks/register').post(registerStock);
router.route('/stocks/history').get(getStockHistory); // For all history
router.route('/stocks/history/:symbol').get(getStockHistory); // For specific stock history


// User Management & Loan Routes
router.route('/users/register').post(registerUser);
router.route('/users/loan').post(takeLoan);

// Trading Operations Routes
router.route('/users/buy').post(buyStock);
router.route('/users/sell').post(sellStock);

// Analytics & Reporting Routes (NEW) <--- ADD THESE LINES
router.route('/users/report/:userId').get(getUserReport); // Report for a specific user
router.route('/stocks/report').get(getStockReport); // Report for all stocks
router.route('/stocks/report/:symbol').get(getStockReport); // Report for a specific stock
router.route('/users/top').get(getTopUsers); // Top users
router.route('/stocks/top').get(getTopStocks); // Top stocks

module.exports = router;