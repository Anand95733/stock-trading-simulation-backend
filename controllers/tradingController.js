const { getDb } = require('../config/sqliteDB');

const MIN_BALANCE_FOR_TRADING = -5000; // Users cannot trade if their balance goes below this (e.g., max loan exhausted + more)

// Helper function to get user's owned stocks
const getUserOwnedStocks = (userId, stockId, callback) => {
    const db = getDb(); // GET DB INSIDE THE HELPER FUNCTION
    if (!db) {
        return callback(new Error('Database not initialized.'), null);
    }

    db.get(
        `SELECT SUM(CASE WHEN type = 'BUY' THEN quantity ELSE 0 END) - SUM(CASE WHEN type = 'SELL' THEN quantity ELSE 0 END) AS ownedQuantity
         FROM transactions
         WHERE userId = ? AND stockId = ?`,
        [userId, stockId],
        (err, row) => {
            if (err) {
                console.error("Error calculating owned quantity:", err.message);
                return callback(err, null);
            }
            callback(null, row ? (row.ownedQuantity || 0) : 0);
        }
    );
};

// @desc    Buy stocks based on price and availability.
// @route   POST /users/buy
// @access  Public (should be private/protected in real app)
const buyStock = (req, res) => {
    const db = getDb(); // GET DB INSIDE THE FUNCTION
    if (!db) {
        return res.status(500).json({ message: 'Database not initialized.' });
    }

    const { userId, stockSymbol, quantity } = req.body;

    if (!userId || !stockSymbol || !quantity || quantity <= 0) {
        return res.status(400).json({ message: 'Please provide userId, stockSymbol, and a valid quantity.' });
    }

    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) {
            console.error("Error fetching user for buy:", err.message);
            return res.status(500).json({ message: 'Error fetching user data.' });
        }
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if user balance is too low to trade (loan exhausted rule)
        if (user.balance < MIN_BALANCE_FOR_TRADING) {
            return res.status(403).json({ message: `Trading temporarily suspended. Your balance (${user.balance.toFixed(2)}) is below the minimum allowed (${MIN_BALANCE_FOR_TRADING.toFixed(2)}) for further trading.` });
        }

        db.get(`SELECT * FROM stocks WHERE symbol = ?`, [stockSymbol.toUpperCase()], (err, stock) => {
            if (err) {
                console.error("Error fetching stock for buy:", err.message);
                return res.status(500).json({ message: 'Error fetching stock data.' });
            }
            if (!stock) {
                return res.status(404).json({ message: 'Stock not found.' });
            }

            const totalCost = quantity * stock.currentPrice;

            if (user.balance < totalCost) {
                return res.status(400).json({ message: `Insufficient funds. Your balance is ${user.balance.toFixed(2)}, required ${totalCost.toFixed(2)}.` });
            }
            if (stock.availableQuantity < quantity) {
                return res.status(400).json({ message: `Insufficient stock quantity available. Only ${stock.availableQuantity} left.` });
            }

            // Begin a transaction for atomicity
            db.serialize(() => {
                db.run('BEGIN TRANSACTION;');

                // Update user balance
                db.run(
                    `UPDATE users SET balance = balance - ? WHERE id = ?`,
                    [totalCost, userId],
                    function(updateUserErr) {
                        if (updateUserErr) {
                            console.error("Error updating user balance (buy):", updateUserErr.message);
                            db.run('ROLLBACK;');
                            return res.status(500).json({ message: 'Error processing buy transaction.' });
                        }

                        // Update stock available quantity
                        db.run(
                            `UPDATE stocks SET availableQuantity = availableQuantity - ? WHERE id = ?`,
                            [quantity, stock.id],
                            function(updateStockErr) {
                                if (updateStockErr) {
                                    console.error("Error updating stock quantity (buy):", updateStockErr.message);
                                    db.run('ROLLBACK;');
                                    return res.status(500).json({ message: 'Error processing buy transaction.' });
                                }

                                // Record transaction
                                db.run(
                                    `INSERT INTO transactions (userId, stockId, type, quantity, pricePerShare, totalAmount) VALUES (?, ?, ?, ?, ?, ?)`,
                                    [userId, stock.id, 'BUY', quantity, stock.currentPrice, totalCost],
                                    function(insertTransErr) {
                                        if (insertTransErr) {
                                            console.error("Error inserting buy transaction record:", insertTransErr.message);
                                            db.run('ROLLBACK;');
                                            return res.status(500).json({ message: 'Error recording transaction.' });
                                        }

                                        db.run('COMMIT;', (commitErr) => {
                                            if (commitErr) {
                                                console.error("Error committing buy transaction:", commitErr.message);
                                                return res.status(500).json({ message: 'Error finalizing transaction.' });
                                            }
                                            // Re-fetch user balance to ensure the response reflects the committed state
                                            db.get(`SELECT balance FROM users WHERE id = ?`, [userId], (fetchErr, updatedUser) => {
                                                if (fetchErr || !updatedUser) {
                                                    console.warn("Could not fetch updated user balance after buy.");
                                                    res.status(200).json({
                                                        message: `Successfully purchased ${quantity} ${stock.symbol} shares. (Balance update might be inaccurate)`,
                                                        totalCost: totalCost
                                                    });
                                                } else {
                                                    res.status(200).json({
                                                        message: `Successfully purchased ${quantity} ${stock.symbol} shares.`,
                                                        totalCost: parseFloat(totalCost.toFixed(2)),
                                                        newBalance: parseFloat(updatedUser.balance.toFixed(2))
                                                    });
                                                }
                                            });
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    });
};

// @desc    Sell owned stocks.
// @route   POST /users/sell
// @access  Public (should be private/protected in real app)
const sellStock = (req, res) => {
    const db = getDb(); // GET DB INSIDE THE FUNCTION
    if (!db) {
        return res.status(500).json({ message: 'Database not initialized.' });
    }

    const { userId, stockSymbol, quantity } = req.body;

    if (!userId || !stockSymbol || !quantity || quantity <= 0) {
        return res.status(400).json({ message: 'Please provide userId, stockSymbol, and a valid quantity.' });
    }

    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) {
            console.error("Error fetching user for sell:", err.message);
            return res.status(500).json({ message: 'Error fetching user data.' });
        }
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if user balance is too low to trade (loan exhausted rule)
        if (user.balance < MIN_BALANCE_FOR_TRADING) {
            return res.status(403).json({ message: `Trading temporarily suspended. Your balance (${user.balance.toFixed(2)}) is below the minimum allowed (${MIN_BALANCE_FOR_TRADING.toFixed(2)}) for further trading.` });
        }

        db.get(`SELECT * FROM stocks WHERE symbol = ?`, [stockSymbol.toUpperCase()], (err, stock) => {
            if (err) {
                console.error("Error fetching stock for sell:", err.message);
                return res.status(500).json({ message: 'Error fetching stock data.' });
            }
            if (!stock) {
                return res.status(404).json({ message: 'Stock not found.' });
            }

            getUserOwnedStocks(userId, stock.id, (err, ownedQuantity) => {
                if (err) {
                    return res.status(500).json({ message: 'Error checking owned stock quantity.' });
                }

                if (ownedQuantity < quantity) {
                    return res.status(400).json({ message: `You only own ${ownedQuantity} of ${stock.symbol}. Cannot sell ${quantity}.` });
                }

                const totalRevenue = quantity * stock.currentPrice;

                // Begin a transaction for atomicity
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION;');

                    // Update user balance
                    db.run(
                        `UPDATE users SET balance = balance + ? WHERE id = ?`,
                        [totalRevenue, userId],
                        function(updateUserErr) {
                            if (updateUserErr) {
                                console.error("Error updating user balance (sell):", updateUserErr.message);
                                db.run('ROLLBACK;');
                                return res.status(500).json({ message: 'Error processing sell transaction.' });
                            }

                            // Update stock available quantity
                            db.run(
                                `UPDATE stocks SET availableQuantity = availableQuantity + ? WHERE id = ?`,
                                [quantity, stock.id],
                                function(updateStockErr) {
                                    if (updateStockErr) {
                                        console.error("Error updating stock quantity (sell):", updateStockErr.message);
                                        db.run('ROLLBACK;');
                                        return res.status(500).json({ message: 'Error processing sell transaction.' });
                                    }

                                    // Record transaction
                                    db.run(
                                        `INSERT INTO transactions (userId, stockId, type, quantity, pricePerShare, totalAmount) VALUES (?, ?, ?, ?, ?, ?)`,
                                        [userId, stock.id, 'SELL', quantity, stock.currentPrice, totalRevenue],
                                        function(insertTransErr) {
                                            if (insertTransErr) {
                                                console.error("Error inserting sell transaction record:", insertTransErr.message);
                                                db.run('ROLLBACK;');
                                                return res.status(500).json({ message: 'Error recording transaction.' });
                                            }

                                            db.run('COMMIT;', (commitErr) => {
                                                if (commitErr) {
                                                    console.error("Error committing sell transaction:", commitErr.message);
                                                    return res.status(500).json({ message: 'Error finalizing transaction.' });
                                                }
                                                // Re-fetch user balance to ensure the response reflects the committed state
                                                db.get(`SELECT balance FROM users WHERE id = ?`, [userId], (fetchErr, updatedUser) => {
                                                    if (fetchErr || !updatedUser) {
                                                        console.warn("Could not fetch updated user balance after sell.");
                                                        res.status(200).json({
                                                            message: `Successfully sold ${quantity} ${stock.symbol} shares. (Balance update might be inaccurate)`,
                                                            totalRevenue: totalRevenue
                                                        });
                                                    } else {
                                                        res.status(200).json({
                                                            message: `Successfully sold ${quantity} ${stock.symbol} shares.`,
                                                            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                                                            newBalance: parseFloat(updatedUser.balance.toFixed(2))
                                                        });
                                                    }
                                                });
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                });
            });
        });
    });
};

module.exports = {
    buyStock,
    sellStock,
};