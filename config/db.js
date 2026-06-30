require('dotenv').config(); // Load environment variables from .env file

const { Sequelize } = require('sequelize');

// Initialize Sequelize with environment variables
const sequelize = new Sequelize(
  process.env.DB_NAME,      // Database name
  process.env.DB_USER,      // Username
  process.env.DB_PASSWORD,  // Password
  {
    host: process.env.DB_HOST,    // Host
    dialect: process.env.DB_DIALECT, // Dialect (e.g., mysql)
    port: process.env.DB_PORT || 3306, // Default MySQL port
    logging: false, // Disable logging if you don't want to see SQL queries in the console
  }
);

sequelize.authenticate()
  .then(() => console.log('Database connected successfully.'))
  .catch(err => {
    console.error('Failed to connect to the database:', err);
    process.exit(1);
  });


module.exports = sequelize;
