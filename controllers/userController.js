const { getDb } = require('../config/sqliteDB');
const db = getDb(); // Get the connected database instance

const MAX_LOAN_AMOUNT = 100000;

// @desc    Register a new user
// @route   POST /users/register
// @access  Public
const registerUser = (req, res) => {
    const { username, password, initialBalance } = req.body; // initialBalance is optional for new users

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password.' });
    }

    db.run(
        `INSERT INTO users (username, password, balance) VALUES (?, ?, ?)`,
        [username, password, initialBalance || 0], // In a real app, hash the password!
        function(err) {
            if (err) {
                if (err.message.includes('SQLITE_CONSTRAINT')) {
                    return res.status(409).json({ message: `User with username '${username}' already exists.` });
                }
                console.error("Error registering user:", err.message);
                return res.status(500).json({ message: 'Error registering user.' });
            }
            res.status(201).json({
                message: 'User registered successfully.',
                user: { id: this.lastID, username, balance: initialBalance || 0, loanAmount: 0 }
            });
        }
    );
};

// @desc    Allow users to take a loan
// @route   POST /users/loan
// @access  Public
const takeLoan = (req, res) => {
    const { userId, amount } = req.body;

    if (!userId || amount === undefined || amount <= 0) {
        return res.status(400).json({ message: 'Please provide a valid userId and a positive loan amount.' });
    }

    db.get(`SELECT balance, loanAmount FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) {
            console.error("Error fetching user for loan:", err.message);
            return res.status(500).json({ message: 'Error fetching user for loan.' });
        }
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const currentLoan = user.loanAmount || 0;
        const newLoanAmount = currentLoan + amount;

        if (newLoanAmount > MAX_LOAN_AMOUNT) {
            return res.status(400).json({
                message: `Loan request (${amount}) exceeds maximum loan limit. Current loan: ${currentLoan}, Max allowed: ${MAX_LOAN_AMOUNT - currentLoan}.`,
                maxLoanAllowed: MAX_LOAN_AMOUNT,
                currentLoan: currentLoan
            });
        }

        // Start a database transaction for atomicity
        db.serialize(() => {
            db.run("BEGIN TRANSACTION;");
            db.run(
                `UPDATE users SET balance = balance + ?, loanAmount = loanAmount + ? WHERE id = ?`,
                [amount, amount, userId],
                function(updateErr) {
                    if (updateErr) {
                        db.run("ROLLBACK;");
                        console.error("Error updating user balance/loan:", updateErr.message);
                        return res.status(500).json({ message: 'Error processing loan.' });
                    }
                    db.run("COMMIT;");
                    res.json({
                        message: `Loan of ${amount} processed successfully.`,
                        newBalance: user.balance + amount,
                        newLoanAmount: newLoanAmount
                    });
                }
            );
        });
    });
};

module.exports = {
    registerUser,
    takeLoan,
};