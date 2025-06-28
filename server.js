const express = require('express');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const cron = require('node-cron');
const cors = require('cors'); // <--- ENSURE CORS IS IMPORTED

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors()); // <--- ENSURE CORS IS USED HERE

// Database connection (Import only connectDB)
const { connectDB } = require('./config/sqliteDB');
const { updateStockPricesDynamically } = require('./controllers/stockController');

// Swagger definition options
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Stock Trading Simulation API',
            version: '1.0.0',
            description: 'API documentation for the Stock Trading Simulation Task',
        },
        servers: [
            {
                url: `http://localhost:${PORT}/api`,
                description: 'Local development server',
            },
        ],
        components: {
            schemas: {}
        }
    },
    apis: [path.resolve(__dirname, 'swaggerDef.yaml')],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Connect to DB, then start server and schedule tasks
connectDB(() => {
    // API routes (ONLY require these AFTER database is connected)
    const apiRoutes = require('./routes/api');
    app.use('/api', apiRoutes); // Prefix all API routes with /api

    // Schedule dynamic stock price updates
    cron.schedule('*/5 * * * *', () => {
        console.log('Running scheduled task: Updating stock prices...');
        updateStockPricesDynamically();
    });

    // Error Handling Middleware
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).send('Something broke on the server!');
    });

    // Start the server
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
        // Run initial price update on startup, now guaranteed to have DB ready
        console.log('Running initial stock price update on startup...');
        updateStockPricesDynamically();
    });
});