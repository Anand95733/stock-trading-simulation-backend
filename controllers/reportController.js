const { getDb } = require('../config/sqliteDB');

// @desc    Get financial report for a specific user including profit/loss and owned stocks
// @route   GET /users/report/:userId
// @access  Public
const getUserReport = (req, res) => {
    const db = getDb(); // GET DB INSIDE THE FUNCTION
    if (!db) {
        return res.status(500).json({ message: 'Database not initialized.' });
    }

    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: 'Please provide a userId.' });
    }

    db.get(`SELECT id, username, balance, loanAmount FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) {
            console.error("Error fetching user for report:", err.message);
            return res.status(500).json({ message: 'Error fetching user data.' });
        }
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Calculate owned stocks and their current value
        const ownedStocksSql = `
            SELECT
                s.symbol,
                s.name,
                s.currentPrice,
                SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE 0 END) - SUM(CASE WHEN t.type = 'SELL' THEN t.quantity ELSE 0 END) AS quantityOwned,
                SUM(CASE WHEN t.type = 'BUY' THEN t.totalAmount ELSE 0 END) AS totalBuyCost,
                SUM(CASE WHEN t.type = 'SELL' THEN t.totalAmount ELSE 0 END) AS totalSellRevenue
            FROM transactions t
            JOIN stocks s ON t.stockId = s.id
            WHERE t.userId = ?
            GROUP BY s.symbol, s.name, s.currentPrice
            HAVING quantityOwned > 0;
        `;

        db.all(ownedStocksSql, [userId], (err, ownedStocks) => {
            if (err) {
                console.error("Error fetching owned stocks for user report:", err.message);
                return res.status(500).json({ message: 'Error fetching owned stocks data.' });
            }

            let totalPortfolioValue = 0;
            const portfolio = ownedStocks.map(stock => {
                const currentPrice = Number(stock.currentPrice || 0);
                const quantityOwned = Number(stock.quantityOwned || 0);
                const totalBuyCost = Number(stock.totalBuyCost || 0);
                const totalSellRevenue = Number(stock.totalSellRevenue || 0);

                const marketValue = quantityOwned * currentPrice;
                const profitLossOnOwned = marketValue - totalBuyCost + totalSellRevenue;

                totalPortfolioValue += marketValue;

                return {
                    symbol: stock.symbol,
                    name: stock.name,
                    quantityOwned: quantityOwned,
                    currentPrice: parseFloat(currentPrice.toFixed(2)),
                    marketValue: parseFloat(marketValue.toFixed(2)),
                    profitLoss: parseFloat((isNaN(profitLossOnOwned) ? 0 : profitLossOnOwned).toFixed(2))
                };
            });

            db.get(`
                SELECT
                    COALESCE(SUM(CASE WHEN type = 'SELL' THEN totalAmount ELSE 0 END), 0) as totalRevenueFromSells,
                    COALESCE(SUM(CASE WHEN type = 'BUY' THEN totalAmount ELSE 0 END), 0) as totalCostFromBuys
                FROM transactions
                WHERE userId = ?;
            `, [userId], (err, allTrades) => {
                if (err) {
                    console.error("Error fetching overall trade data:", err.message);
                    allTrades = { totalRevenueFromSells: 0, totalCostFromBuys: 0 };
                }

                const totalRevenueFromSells = Number(allTrades.totalRevenueFromSells);
                const totalCostFromBuys = Number(allTrades.totalCostFromBuys);

                const overallNetProfitLoss = totalRevenueFromSells - totalCostFromBuys;

                res.json({
                    userId: user.id,
                    username: user.username,
                    currentBalance: parseFloat(user.balance.toFixed(2)),
                    loanAmount: parseFloat((user.loanAmount || 0).toFixed(2)),
                    portfolio: portfolio,
                    totalPortfolioValue: parseFloat(totalPortfolioValue.toFixed(2)),
                    totalProfitLoss: parseFloat((isNaN(overallNetProfitLoss) ? 0 : overallNetProfitLoss).toFixed(2))
                });
            });
        });
    });
};


// @desc    Get performance report for all stocks or a specific stock
// @route   GET /stocks/report/:symbol?
// @access  Public
const getStockReport = (req, res) => {
    const db = getDb();
    if (!db) {
        return res.status(500).json({ message: 'Database not initialized.' });
    }

    const { symbol } = req.params;

    let sql = `
        SELECT
            s.id,
            s.symbol,
            s.name,
            s.currentPrice,
            s.initialPrice,
            COALESCE(SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE 0 END), 0) AS totalVolumeBought,
            COALESCE(SUM(CASE WHEN t.type = 'SELL' THEN t.quantity ELSE 0 END), 0) AS totalVolumeSold,
            COALESCE(SUM(CASE WHEN t.type = 'BUY' THEN t.totalAmount ELSE 0 END), 0) AS totalValueBought,
            COALESCE(SUM(CASE WHEN t.type = 'SELL' THEN t.totalAmount ELSE 0 END), 0) AS totalValueSold
        FROM stocks s
        LEFT JOIN transactions t ON s.id = t.stockId
    `;
    let params = [];
    let groupBy = ` GROUP BY s.id, s.symbol, s.name, s.currentPrice, s.initialPrice`;
    let orderBy = ` ORDER BY s.symbol ASC`;

    if (symbol) {
        sql += ` WHERE s.symbol = ?`;
        params.push(symbol.toUpperCase());
    }

    sql += groupBy + orderBy;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching stock report from DB:", err.message);
            return res.status(500).json({ message: 'Error fetching stock report.' });
        }

        try {
            const report = rows.map(row => {
                // Ensure all values used in calculations are numbers, using Number() explicitly
                const currentPrice = Number(row.currentPrice) || 0;
                const initialPrice = Number(row.initialPrice) || 0;
                const totalVolumeBought = Number(row.totalVolumeBought) || 0;
                const totalVolumeSold = Number(row.totalVolumeSold) || 0;
                const totalValueBought = Number(row.totalValueBought) || 0;
                const totalValueSold = Number(row.totalValueSold) || 0;

                const priceChange = currentPrice - initialPrice;

                let percentageChange = 0;
                // Avoid division by zero and ensure initialPrice is a valid number
                if (initialPrice !== 0 && !isNaN(initialPrice)) {
                    percentageChange = (priceChange / initialPrice) * 100;
                }

                const totalVolumeTraded = totalVolumeBought + totalVolumeSold;
                const totalValueTraded = totalValueBought + totalValueSold;

                return {
                    id: row.id,
                    symbol: row.symbol,
                    name: row.name,
                    currentPrice: parseFloat(currentPrice.toFixed(2)),
                    initialPrice: parseFloat(initialPrice.toFixed(2)),
                    priceChange: parseFloat(priceChange.toFixed(2)),
                    percentageChange: parseFloat((isNaN(percentageChange) ? 0 : percentageChange).toFixed(2)),
                    totalVolumeTraded: totalVolumeTraded,
                    totalValueTraded: parseFloat(totalValueTraded.toFixed(2))
                };
            });
            res.json(report);
        } catch (transformError) {
            console.error("Error transforming stock report data:", transformError.message, transformError.stack);
            return res.status(500).json({ message: 'Error processing stock report data.' });
        }
    });
};

// @desc    Get top performing users (based on total profit/loss)
// @route   GET /users/top
// @access  Public
const getTopUsers = (req, res) => {
    const db = getDb();
    if (!db) {
        return res.status(500).json({ message: 'Database not initialized.' });
    }

    const sql = `
        SELECT
            u.id,
            u.username,
            u.balance,
            u.loanAmount,
            COALESCE(SUM(CASE WHEN t.type = 'SELL' THEN t.totalAmount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN t.type = 'BUY' THEN t.totalAmount ELSE 0 END), 0) AS netProfitLoss
        FROM users u
        LEFT JOIN transactions t ON u.id = t.userId
        GROUP BY u.id, u.username, u.balance, u.loanAmount
        ORDER BY netProfitLoss DESC
        LIMIT 10;
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching top users:", err.message);
            return res.status(500).json({ message: 'Error fetching top users.' });
        }
        res.json(rows.map(row => ({
            id: row.id,
            username: row.username,
            currentBalance: parseFloat(row.balance.toFixed(2)),
            loanAmount: parseFloat((row.loanAmount || 0).toFixed(2)),
            netProfitLoss: parseFloat((row.netProfitLoss || 0).toFixed(2))
        })));
    });
};

// @desc    Get top performing stocks (based on total traded value)
// @route   GET /stocks/top
// @access  Public
const getTopStocks = (req, res) => {
    const db = getDb();
    if (!db) {
        return res.status(500).json({ message: 'Database not initialized.' });
    }

    const sql = `
        SELECT
            s.id,
            s.symbol,
            s.name,
            s.currentPrice,
            COALESCE(SUM(t.totalAmount), 0) AS totalTradedValue
        FROM stocks s
        JOIN transactions t ON s.id = t.stockId
        GROUP BY s.id, s.symbol, s.name, s.currentPrice
        ORDER BY totalTradedValue DESC
        LIMIT 10;
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching top stocks:", err.message);
            return res.status(500).json({ message: 'Error fetching top stocks.' });
        }
        res.json(rows.map(row => ({
            id: row.id,
            symbol: row.symbol,
            name: row.name,
            currentPrice: parseFloat(row.currentPrice.toFixed(2)),
            totalTradedValue: parseFloat((row.totalTradedValue || 0).toFixed(2))
        })));
    });
};

module.exports = {
    getUserReport,
    getStockReport,
    getTopUsers,
    getTopStocks,
};