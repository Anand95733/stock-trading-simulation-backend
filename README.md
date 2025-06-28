# Stock Trading Simulation Backend

This project implements a robust backend for a stock trading simulation, developed as part of skill enhancement at NxtWave. It provides comprehensive APIs for managing stocks and users, facilitating trading operations, and generating insightful analytics and reports.

## About the Developer

Hi, I'm Anand! I hold a B.Tech degree and am deeply passionate about building practical solutions using the **MERN stack (MongoDB, Express, React, Node.js)**. This project demonstrates my backend development skills, particularly with Node.js and RESTful APIs, focusing on challenging aspects like dynamic data handling and ensuring data integrity.

Beyond coding, I'm always eager to learn new technologies and apply smart shortcuts to solve aptitude challenges, and I'm confident in both my technical and communication skills.

## Features

This backend system provides the following core functionalities:

* **Stock Management:**
    * Register new stocks with initial price and available quantity.
    * Retrieve historical price data for individual stocks or all stocks.
* **User Management:**
    * Register new users with an initial balance.
    * Allow users to take loans up to a defined limit.
* **Trading Operations:**
    * **Buy Stocks:** Users can purchase available stocks, which updates their balance and the stock's available quantity. Transactions are recorded.
    * **Sell Stocks:** Users can sell owned stocks, updating their balance and the stock's available quantity. Transactions are recorded.
* **Analytics & Reporting:**
    * Generate individual user profit/loss reports.
    * Provide performance reports for all stocks or a specific stock.
    * List top-performing users based on profit/loss.
    * List top-performing stocks based on total traded value.
* **API Documentation:** Comprehensive and interactive API documentation using Swagger UI.

## Technologies Used

* **Node.js:** JavaScript runtime environment.
* **Express.js:** Web application framework for Node.js.
* **SQLite3:** Lightweight, file-based relational database for data persistence.
* **Swagger / Swagger-UI Express:** For interactive API documentation and testing.
* **Dotenv:** For managing environment variables.

## Setup and Installation

Follow these steps to get the project up and running on your local machine.

### Prerequisites

* Node.js (LTS version recommended)
* npm (Node Package Manager, comes with Node.js)
* Git

### 1. Clone the Repository

First, clone this repository to your local machine using Git:

```bash
git clone https://github.com/Anand95733/stock-trading-simulation-backend
