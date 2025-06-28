const express = require('express');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path'); // Import the path module

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Database connection
// CORRECTED: Importing connectDB from the correct path.
const { connectDB } = require('./config/sqliteDB');
connectDB(); // Call the connectDB function to establish database connection

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
        url: `http://localhost:${PORT}`, // Dynamically set server URL
        description: 'Local development server',
      },
    ],
    components: {
      schemas: {} // Placeholder for any shared schemas if needed later
    }
  },
  apis: [path.resolve(__dirname, 'swaggerDef.yaml')],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes); // Prefix all API routes with /api

// Error Handling Middleware (optional, but good practice)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke on the server!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});