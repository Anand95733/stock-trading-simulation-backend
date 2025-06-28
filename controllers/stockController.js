const { getDb } = require('../config/sqliteDB');
const db = getDb(); // Get the connected database instance

// @desc    Register a new stock
// @route   POST /stocks/register
// @access  Public
const registerStock = (req, res) => {
    const { symbol, name, initialPrice, availableQuantity } = req.body;

    if (!symbol || !name || initialPrice === undefined || !availableQuantity === undefined) {
        return res.status(400).json({ message: 'Please provide symbol, name, initialPrice, and availableQuantity.' });
    }

    db.run(
        `INSERT INTO stocks (symbol, name, currentPrice, availableQuantity) VALUES (?, ?, ?, ?)`,
        [symbol.toUpperCase(), name, initialPrice, availableQuantity],
        function(err) {
            if (err) {
                // Check if the error is due to unique constraint (symbol already exists)
                if (err.message.includes('SQLITE_CONSTRAINT')) {
                    return res.status(409).json({ message: `Stock with symbol '${symbol.toUpperCase()}' already exists.` });
                }
                console.error("Error registering stock:", err.message);
                return res.status(500).json({ message: 'Error registering stock.' });
            }
            const newStockId = this.lastID;
            // Also add an initial price history entry
            db.run(
                `INSERT INTO stock_price_history (stockId, price) VALUES (?, ?)`,
                [newStockId, initialPrice],
                (historyErr) => {
                    if (historyErr) {
                        console.warn("Could not record initial stock price history:", historyErr.message);
                    }
                }
            );
            res.status(201).json({
                message: 'Stock registered successfully.',
                stock: { id: newStockId, symbol: symbol.toUpperCase(), name, currentPrice: initialPrice, availableQuantity }
            });
        }
    );
};

// @desc    Retrieve stock price history
// @route   GET /stocks/history/:symbol (or just /stocks/history for all, then filter on frontend)
// @access  Public
const getStockHistory = (req, res) => {
    const { symbol } = req.params; // Expect symbol in URL parameter if getting specific history

    let sql = `SELECT * FROM stock_price_history`;
    let params = [];

    if (symbol) {
        // Join with stocks table to filter by symbol
        sql = `SELECT sph.* FROM stock_price_history sph JOIN stocks s ON sph.stockId = s.id WHERE s.symbol = ? ORDER BY sph.timestamp ASC`;
        params = [symbol.toUpperCase()];
    } else {
        // Get history for all stocks (might be large, consider pagination/filters for real app)
        sql = `SELECT sph.*, s.symbol, s.name FROM stock_price_history sph JOIN stocks s ON sph.stockId = s.id ORDER BY sph.timestamp ASC`;
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching stock history:", err.message);
            return res.status(500).json({ message: 'Error fetching stock history.' });
        }
        res.json(rows);
    });
};

module.exports = {
    registerStock,
    getStockHistory,
};