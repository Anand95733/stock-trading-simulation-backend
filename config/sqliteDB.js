const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/database.sqlite');
let db; // This will hold the database instance

/**
 * Connects to the SQLite database and initializes tables if they don't exist.
 * Calls the provided callback function once the database is ready.
 * @param {function} callback - Function to call once DB is connected and tables are ready.
 */
const connectDB = (callback) => {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error connecting to SQLite database:', err.message);
            process.exit(1); // Exit process if cannot connect to DB
        }
        console.log('Connected to SQLite database at', dbPath);

        // Enable foreign key constraints
        db.run('PRAGMA foreign_keys = ON;', (err) => {
            if (err) {
                console.error('Error enabling foreign keys:', err.message);
            } else {
                console.log('Foreign keys enabled.');
            }

            // Create tables if they don't exist
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        balance REAL DEFAULT 0.00,
                        loanAmount REAL DEFAULT 0.00
                    )
                `, (err) => {
                    if (err) console.error("Error creating users table:", err.message);
                    else console.log("Users table checked/created.");
                });

                db.run(`
                    CREATE TABLE IF NOT EXISTS stocks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        symbol TEXT UNIQUE NOT NULL,
                        name TEXT NOT NULL,
                        currentPrice REAL DEFAULT 0.00,
                        initialPrice REAL DEFAULT 0.00, -- Ensure this column exists
                        availableQuantity INTEGER DEFAULT 0
                    )
                `, (err) => {
                    if (err) console.error("Error creating stocks table:", err.message);
                    else console.log("Stocks table checked/created.");
                });

                db.run(`
                    CREATE TABLE IF NOT EXISTS transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        userId INTEGER NOT NULL,
                        stockId INTEGER NOT NULL,
                        type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
                        quantity INTEGER NOT NULL,
                        pricePerShare REAL NOT NULL,
                        totalAmount REAL NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (stockId) REFERENCES stocks(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) console.error("Error creating transactions table:", err.message);
                    else console.log("Transactions table checked/created.");
                });

                db.run(`
                    CREATE TABLE IF NOT EXISTS stock_price_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        stockId INTEGER NOT NULL,
                        price REAL NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (stockId) REFERENCES stocks(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) console.error("Error creating stock price history table:", err.message);
                    else console.log("Stock Price History table checked/created.");
                    console.log("All tables checked/created.");
                    if (callback && typeof callback === 'function') {
                        callback(); // Execute callback when DB and tables are ready
                    }
                });
            });
        });
    });
};

const getDb = () => db; // Getter for the database instance

module.exports = {
    connectDB,
    getDb
};