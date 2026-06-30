const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config(); // Load environment variables
const sequelize = require('./config/db'); // Initialize DB connection
require('./models/userModel');
require('./models/patientModel');
require('./models/taskModel');
require('./models/woundCaseModel');
require('./models/patientHandoffModel');
require('./models/notificationModel');
require('./models/subscriptionModel');
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const taskRoutes = require('./routes/taskRoutes');
const woundCaseRoutes = require('./routes/woundCaseRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const handoffRoutes = require('./routes/handoffRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/wound-cases', woundCaseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/handoffs', handoffRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Start server
sequelize
  .sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to sync database:', error);
    process.exit(1);
  });
