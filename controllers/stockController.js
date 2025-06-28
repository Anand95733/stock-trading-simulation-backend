const { getDb } = require('../config/sqliteDB');

// @desc    Register a new stock
// @route   POST /stocks/register
// @access  Public
const registerStock = (req, res) => {
    const db = getDb(); // GET DB INSIDE THE FUNCTION
    if (!db) {
        return res.status(500).json({ message: 'Database not initialized.' });
    }

    const { symbol, name, initialPrice, availableQuantity } = req.body;

    if (!symbol || !name || initialPrice === undefined || availableQuantity === undefined) {
        return res.status(400).json({ message: 'Please provide symbol, name, initialPrice, and availableQuantity.' });
    }

    // Ensure initialPrice is within the 1 to 100 range
    if (initialPrice < 1 || initialPrice > 100) {
        return res.status(400).json({ message: 'Initial price must be between 1 and 100.' });
    }


    db.run(
        `INSERT INTO stocks (symbol, name, currentPrice, availableQuantity) VALUES (?, ?, ?, ?)`,
        [symbol.toUpperCase(), name, initialPrice, availableQuantity],
        function(err) {
            if (err) {
                if (err.message.includes('SQLITE_CONSTRAINT')) {
                    return res.status(409).json({ message: `Stock with symbol '${symbol.toUpperCase()}' already exists.` });
                }
                console.error("Error registering stock:", err.message);
                return res.status(500).json({ message: 'Error registering stock.' });
            }
            const newStockId = this.lastID;
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
    const db = getDb(); // GET DB INSIDE THE FUNCTION
    if (!db) {
        return res.status(500).json({ message: 'Database not initialized.' });
    }

    const { symbol } = req.params;

    let sql = `SELECT * FROM stock_price_history`;
    let params = [];

    if (symbol) {
        sql = `SELECT sph.* FROM stock_price_history sph JOIN stocks s ON sph.stockId = s.id WHERE s.symbol = ? ORDER BY sph.timestamp ASC`;
        params = [symbol.toUpperCase()];
    } else {
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

// @desc    Dynamically update all stock prices and record history
// @access  Internal (called by cron job)
const updateStockPricesDynamically = () => {
    const db = getDb(); // GET DB INSIDE THE FUNCTION
    if (!db) {
        console.error('Database not initialized for dynamic price update. Skipping update.');
        return;
    }

    db.all(`SELECT id, symbol, currentPrice FROM stocks`, [], (err, stocks) => {
        if (err) {
            console.error("Error fetching stocks for dynamic update:", err.message);
            return;
        }

        if (stocks.length === 0) {
            console.log("No stocks registered to update prices dynamically.");
            return;
        }

        stocks.forEach(stock => {
            const changePercentage = (Math.random() * 0.10) - 0.05; // -0.05 to +0.05 (-5% to +5%)
            let newPrice = stock.currentPrice * (1 + changePercentage);

            // Enforce price range between 1 and 100
            newPrice = Math.max(1.00, Math.min(newPrice, 100.00)); // Price must be at least 1 and at most 100

            // Round to 2 decimal places
            newPrice = parseFloat(newPrice.toFixed(2));

            // Update stock's currentPrice in the stocks table
            db.run(
                `UPDATE stocks SET currentPrice = ? WHERE id = ?`,
                [newPrice, stock.id],
                function(updateErr) {
                    if (updateErr) {
                        console.error(`Error updating price for ${stock.symbol}:`, updateErr.message);
                    } else {
                        console.log(`Updated ${stock.symbol} to ${newPrice}`);
                        // Record the new price in stock_price_history
                        db.run(
                            `INSERT INTO stock_price_history (stockId, price) VALUES (?, ?)`,
                            [stock.id, newPrice],
                            (historyErr) => {
                                if (historyErr) {
                                    console.warn(`Could not record price history for ${stock.symbol}:`, historyErr.message);
                                }
                            }
                        );
                    }
                }
            );
        });
    });
};


module.exports = {
    registerStock,
    getStockHistory,
    updateStockPricesDynamically
};