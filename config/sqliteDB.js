const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs'); // Import fs to ensure directory exists

// Path to your SQLite database file from .env
const DB_PATH = process.env.DATABASE_PATH;
const dbFile = path.resolve(__dirname, '..', DB_PATH); // Resolve absolute path from config folder

let db; // Variable to hold the database instance

const connectDB = () => {
  // Ensure the directory for the database file exists
  const dbDir = path.dirname(dbFile);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  }

  db = new sqlite3.Database(dbFile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.error(`Error connecting to SQLite: ${err.message}`);
      process.exit(1); // Exit process with failure
    } else {
      console.log(`Connected to SQLite database at ${dbFile}`);
      // Enable foreign key constraints (important for relational integrity)
      db.run("PRAGMA foreign_keys = ON;");
      console.log("Foreign keys enabled.");

      // --- Create Tables if they don't exist ---
      // Users Table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL, -- In a real app, this would be hashed!
        balance REAL DEFAULT 0.0,
        loanAmount REAL DEFAULT 0.0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log('Users table checked/created.');

      // Stocks Table
      db.run(`CREATE TABLE IF NOT EXISTS stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        currentPrice REAL NOT NULL,
        availableQuantity INTEGER NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log('Stocks table checked/created.');

      // Transactions Table
      db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        stockId INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'BUY' or 'SELL'
        quantity INTEGER NOT NULL,
        pricePerShare REAL NOT NULL,
        totalAmount REAL NOT NULL,
        transactionDate TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (stockId) REFERENCES stocks(id) ON DELETE CASCADE
      )`);
      console.log('Transactions table checked/created.');

      // Stock Price History Table
      db.run(`CREATE TABLE IF NOT EXISTS stock_price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stockId INTEGER NOT NULL,
        price REAL NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stockId) REFERENCES stocks(id) ON DELETE CASCADE
      )`);
      console.log('Stock Price History table checked/created.');

      // You might also need a 'loans' table if loans are more complex than just a user balance field
      // For now, loanAmount in users table is assumed to be sufficient as per assignment simplicity.

      console.log('All tables checked/created.');
    }
  });
};

const getDb = () => db; // Export a function to get the database instance

module.exports = { connectDB, getDb };