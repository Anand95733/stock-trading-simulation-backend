// utils/simulateTrading.js
const axios = require('axios');

// --- Configuration ---
const API_BASE_URL = 'http://localhost:5000/api'; // Ensure this matches your server.js prefix
const NUMBER_OF_SIMULATED_USERS = 8; // Simulate between 5 and 10 users
const SIMULATION_TRADES_PER_USER = 5; // How many trades each user makes
const INITIAL_STOCK_PRICE_RANGE = { min: 10, max: 80 }; // For new stocks if needed
const INITIAL_USER_BALANCE_RANGE = { min: 5000, max: 20000 }; // For new users

// --- API Client Functions ---
const registerStock = async (symbol, name, initialPrice, availableQuantity) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/stocks/register`, {
            symbol, name, initialPrice, availableQuantity
        });
        console.log(`[STOCK] Registered ${symbol}: ${response.data.message}`);
        return response.data.stock;
    } catch (error) {
        if (error.response && error.response.status === 409) {
            console.log(`[STOCK] ${symbol} already exists. Skipping registration.`);
            // Fetch existing stock if it already exists to use its ID
            const existingStockResponse = await axios.get(`${API_BASE_URL}/stocks/report/${symbol}`);
            return existingStockResponse.data[0]; // Assuming stock report returns array of one if symbol is specific
        }
        console.error(`[ERROR] Registering stock ${symbol}:`, error.response ? error.response.data : error.message);
        return null;
    }
};

const registerUser = async (username, password, initialBalance) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/users/register`, {
            username, password, initialBalance
        });
        console.log(`[USER] Registered ${username}: ${response.data.message}`);
        return response.data.user;
    } catch (error) {
        if (error.response && error.response.status === 409) {
            console.log(`[USER] ${username} already exists. Skipping registration.`);
            // In a real app, you might fetch the existing user's ID here
            return { id: null, username }; // Return partial info
        }
        console.error(`[ERROR] Registering user ${username}:`, error.response ? error.response.data : error.message);
        return null;
    }
};

const buyStock = async (userId, stockSymbol, quantity) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/users/buy`, {
            userId, stockSymbol, quantity
        });
        console.log(`[BUY] User ${userId} bought ${quantity} of ${stockSymbol}: ${response.data.message}`);
        return response.data;
    } catch (error) {
        console.error(`[ERROR] User ${userId} buying ${quantity} of ${stockSymbol}:`, error.response ? error.response.data : error.message);
        return null;
    }
};

const sellStock = async (userId, stockSymbol, quantity) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/users/sell`, {
            userId, stockSymbol, quantity
        });
        console.log(`[SELL] User ${userId} sold ${quantity} of ${stockSymbol}: ${response.data.message}`);
        return response.data;
    } catch (error) {
        console.error(`[ERROR] User ${userId} selling ${quantity} of ${stockSymbol}:`, error.response ? error.response.data : error.message);
        return null;
    }
};

const getUserReport = async (userId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/users/report/${userId}`);
        console.log(`--- User Report for User ${userId} (${response.data.username}) ---`);
        console.log(`Balance: ${response.data.currentBalance.toFixed(2)} | Loan: ${response.data.loanAmount.toFixed(2)}`);
        console.log(`Net P/L: ${response.data.totalProfitLoss.toFixed(2)}`);
        console.log(`Portfolio Value: ${response.data.totalPortfolioValue.toFixed(2)}`);
        response.data.portfolio.forEach(s => console.log(`  - ${s.symbol}: ${s.quantityOwned} shares @ ${s.currentPrice.toFixed(2)} (P/L: ${s.profitLoss.toFixed(2)})`));
        console.log('--------------------------------------');
        return response.data;
    } catch (error) {
        console.error(`[ERROR] Fetching report for user ${userId}:`, error.response ? error.response.data : error.message);
        return null;
    }
};

const getStocksReport = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/stocks/report`);
        console.log('\n--- Overall Stock Performance Report ---');
        response.data.forEach(s => {
            console.log(`  ${s.symbol} (${s.name}): Current Price ${s.currentPrice.toFixed(2)} | Change ${s.priceChange.toFixed(2)} (${s.percentageChange.toFixed(2)}%) | Volume ${s.totalVolumeTraded} | Value ${s.totalValueTraded.toFixed(2)}`);
        });
        console.log('------------------------------------------');
        return response.data;
    } catch (error) {
        console.error(`[ERROR] Fetching all stocks report:`, error.response ? error.response.data : error.message);
        return null;
    }
};

// Helper to pause execution for a bit
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Main Simulation Logic ---
const runSimulation = async () => {
    console.log('Starting trading simulation...');

    // 1. Register Initial Stocks (if not already there)
    const initialStocks = [
        { symbol: "TESLA", name: "Tesla Motors", initialPrice: Math.random() * (INITIAL_STOCK_PRICE_RANGE.max - INITIAL_STOCK_PRICE_RANGE.min) + INITIAL_STOCK_PRICE_RANGE.min, availableQuantity: 500 + Math.floor(Math.random() * 500) },
        { symbol: "AMZON", name: "Amazon Corp", initialPrice: Math.random() * (INITIAL_STOCK_PRICE_RANGE.max - INITIAL_STOCK_PRICE_RANGE.min) + INITIAL_STOCK_PRICE_RANGE.min, availableQuantity: 700 + Math.floor(Math.random() * 500) },
        { symbol: "APPEL", name: "Apple Inc.", initialPrice: Math.random() * (INITIAL_STOCK_PRICE_RANGE.max - INITIAL_STOCK_PRICE_RANGE.min) + INITIAL_STOCK_PRICE_RANGE.min, availableQuantity: 1000 + Math.floor(Math.random() * 500) },
        { symbol: "NETFL", name: "Netflix Inc.", initialPrice: Math.random() * (INITIAL_STOCK_PRICE_RANGE.max - INITIAL_STOCK_PRICE_RANGE.min) + INITIAL_STOCK_PRICE_RANGE.min, availableQuantity: 600 + Math.floor(Math.random() * 500) },
        { symbol: "GOOGL", name: "Alphabet Inc.", initialPrice: Math.random() * (INITIAL_STOCK_PRICE_RANGE.max - INITIAL_STOCK_PRICE_RANGE.min) + INITIAL_STOCK_PRICE_RANGE.min, availableQuantity: 400 + Math.floor(Math.random() * 500) },
    ];

    const registeredStocks = [];
    for (const stock of initialStocks) {
        const s = await registerStock(stock.symbol, stock.name, parseFloat(stock.initialPrice.toFixed(2)), stock.availableQuantity);
        if (s) registeredStocks.push(s);
        await sleep(100); // Small delay
    }

    if (registeredStocks.length === 0) {
        console.warn("No stocks available for simulation. Please ensure stocks are registered or backend is working.");
        return;
    }
    const stockSymbols = registeredStocks.map(s => s.symbol);
    console.log(`\nAvailable stocks for trading: ${stockSymbols.join(', ')}\n`);

    // 2. Register Users
    const simulatedUsers = [];
    for (let i = 1; i <= NUMBER_OF_SIMULATED_USERS; i++) {
        const username = `SimUser${i}`;
        const password = `pass${i}`;
        const initialBalance = Math.random() * (INITIAL_USER_BALANCE_RANGE.max - INITIAL_USER_BALANCE_RANGE.min) + INITIAL_USER_BALANCE_RANGE.min;
        const user = await registerUser(username, password, parseFloat(initialBalance.toFixed(2)));
        if (user && user.id) { // Only add if user was successfully created and has an ID
            simulatedUsers.push(user);
        } else if (user && user.username) {
             // If user exists but ID is null (due to 409 and not fetching existing ID), log it
            console.log(`Skipping simulation for existing user ${user.username} as ID could not be retrieved.`);
        }
        await sleep(100); // Small delay
    }

    if (simulatedUsers.length === 0) {
        console.warn("No users registered for simulation. Please ensure users are registered or backend is working.");
        return;
    }
    console.log(`\nRegistered ${simulatedUsers.length} users for simulation.\n`);


    // 3. Simulate Trading
    console.log('Simulating trading activity...');
    for (let i = 0; i < SIMULATION_TRADES_PER_USER; i++) {
        for (const user of simulatedUsers) {
            const randomStockSymbol = stockSymbols[Math.floor(Math.random() * stockSymbols.length)];
            const randomQuantity = Math.floor(Math.random() * 10) + 1; // 1 to 10 shares

            // Randomly decide to buy or sell (50/50 chance)
            if (Math.random() < 0.5) {
                await buyStock(user.id, randomStockSymbol, randomQuantity);
            } else {
                await sellStock(user.id, randomStockSymbol, randomQuantity);
            }
            await sleep(500 + Math.random() * 500); // Random delay between trades
        }
        console.log(`--- Finished Round ${i + 1} of trading for all users ---\n`);
        await sleep(1000); // Small pause after each round
    }

    console.log('\nSimulation complete. Fetching final reports...');

    // 4. Fetch Reports
    for (const user of simulatedUsers) {
        await getUserReport(user.id);
        await sleep(200);
    }
    await getStocksReport();

    console.log('\nSimulation script finished.');
};

runSimulation();