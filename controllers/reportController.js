const { getDb } = require('../config/sqliteDB');
const db = getDb(); // Get the connected database instance

// Helper function to calculate profit/loss from transactions
const calculateProfitLoss = (transactions) => {
    let profit = 0;
    let loss = 0;
    transactions.forEach(t => {
        if (t.type === 'SELL') {
            profit += t.totalAmount; // Money gained from selling
        } else if (t.type === 'BUY') {
            loss += t.totalAmount; // Money spent on buying
        }
    });
    return profit - loss;
};

// @desc    Fetch user profit/loss report
// @route   GET /users/report/:userId
// @access  Public (should be private in real app)
const getUserReport = (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: 'Please provide a userId.' });
    }

    db.get(`SELECT username, balance, loanAmount FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) {
            console.error("Error fetching user for report:", err.message);
            return res.status(500).json({ message: 'Error fetching user data.' });
        }
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        db.all(`SELECT * FROM transactions WHERE userId = ? ORDER BY transactionDate ASC`, [userId], (err, transactions) => {
            if (err) {
                console.error("Error fetching user transactions:", err.message);
                return res.status(500).json({ message: 'Error fetching user transactions.' });
            }

            const profitLoss = calculateProfitLoss(transactions);

            res.json({
                userId: user.id,
                username: user.username,
                currentBalance: user.balance,
                currentLoanAmount: user.loanAmount,
                totalProfitLoss: profitLoss,
                transactions: transactions // Include detailed transactions if needed for report
            });
        });
    });
};

// @desc    Get stock-wise performance report
// @route   GET /stocks/report/:symbol (or all if no symbol)
// @access  Public
const getStockReport = (req, res) => {
    const { symbol } = req.params;
    let sql = `
        SELECT
            s.symbol,
            s.name,
            s.currentPrice,
            s.availableQuantity,
            SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE 0 END) AS totalQuantityBought,
            SUM(CASE WHEN t.type = 'SELL' THEN t.quantity ELSE 0 END) AS totalQuantitySold,
            SUM(CASE WHEN t.type = 'BUY' THEN t.totalAmount ELSE 0 END) AS totalValueBought,
            SUM(CASE WHEN t.type = 'SELL' THEN t.totalAmount ELSE 0 END) AS totalValueSold
        FROM stocks s
        LEFT JOIN transactions t ON s.id = t.stockId
    `;
    let params = [];

    if (symbol) {
        sql += ` WHERE s.symbol = ?`;
        params = [symbol.toUpperCase()];
    }
    sql += ` GROUP BY s.id, s.symbol, s.name, s.currentPrice, s.availableQuantity`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching stock report:", err.message);
            return res.status(500).json({ message: 'Error fetching stock report.' });
        }
        if (rows.length === 0 && symbol) {
            return res.status(404).json({ message: `Stock with symbol '${symbol.toUpperCase()}' not found or has no transactions.` });
        }
        res.json(rows);
    });
};


// @desc    List top-performing users (based on profit/loss)
// @route   GET /users/top
// @access  Public
const getTopUsers = (req, res) => {
    // This query aggregates transaction data for each user to calculate their net profit/loss
    const sql = `
        SELECT
            u.id,
            u.username,
            SUM(CASE WHEN t.type = 'SELL' THEN t.totalAmount ELSE -t.totalAmount END) AS netProfitLoss
        FROM users u
        JOIN transactions t ON u.id = t.userId
        GROUP BY u.id, u.username
        ORDER BY netProfitLoss DESC
        LIMIT 10; -- Adjust limit as needed
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching top users:", err.message);
            return res.status(500).json({ message: 'Error fetching top users.' });
        }
        res.json(rows);
    });
};

// @desc    List top-performing stocks (based on total transaction value)
// @route   GET /stocks/top
// @access  Public
const getTopStocks = (req, res) => {
    // This query aggregates transaction data for each stock to find total traded value
    const sql = `
        SELECT
            s.id,
            s.symbol,
            s.name,
            SUM(t.totalAmount) AS totalTradedValue
        FROM stocks s
        JOIN transactions t ON s.id = t.stockId
        GROUP BY s.id, s.symbol, s.name
        ORDER BY totalTradedValue DESC
        LIMIT 10; -- Adjust limit as needed
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching top stocks:", err.message);
            return res.status(500).json({ message: 'Error fetching top stocks.' });
        }
        res.json(rows);
    });
};


module.exports = {
    getUserReport,
    getStockReport,
    getTopUsers,
    getTopStocks,
};