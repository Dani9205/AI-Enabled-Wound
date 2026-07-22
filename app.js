const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config(); // Load environment variables
const sequelize = require('./config/db'); // Initialize DB connection
require('./models/userModel');
require('./models/patientModel');
require('./models/taskModel');
require('./models/woundCaseModel');
require('./models/patientHandoffModel');
require('./models/notificationModel');
require('./models/subscriptionModel');
require('./models/organizationModel');
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const taskRoutes = require('./routes/taskRoutes');
const woundCaseRoutes = require('./routes/woundCaseRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const handoffRoutes = require('./routes/handoffRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const doctorAuthRoutes = require('./routes/doctorAuthRoutes');
const patientAuthRoutes = require('./routes/patientAuthRoutes');
const patientAppRoutes = require('./routes/patientAppRoutes');
const patientProfileRoutes = require('./routes/patientProfileRoutes');
const patientNotificationRoutes = require('./routes/patientNotificationRoutes');
const doctorManagementRoutes = require('./routes/doctorManagementRoutes');
const doctorNotificationRoutes = require('./routes/doctorNotificationRoutes');
const doctorPatientHandoffRoutes = require('./routes/doctorPatientHandoffRoutes');
const doctorProfileSettingsRoutes = require('./routes/doctorProfileSettingsRoutes');
const doctorTaskRoutes = require('./routes/doctorTaskRoutes');
const doctorWoundDetailsRoutes = require('./routes/doctorWoundDetailsRoutes');
const doctorPatientRoutes = require('./routes/doctorPatientRoutes');
const doctorWoundCaseRoutes = require('./routes/doctorWoundCaseRoutes');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/admin', adminRoutes);
app.use('/api/doctor/auth', doctorAuthRoutes);
app.use('/api/patient/auth', patientAuthRoutes);
app.use('/api/patient/app', patientAppRoutes);
app.use('/api/patient/profile', patientProfileRoutes);
app.use('/api/patient/notifications', patientNotificationRoutes);
app.use('/api/doctor/notifications', doctorNotificationRoutes);
app.use('/api/doctor/patient-handoff', doctorPatientHandoffRoutes);
app.use('/api/doctor/profile-settings', doctorProfileSettingsRoutes);
app.use('/api/doctor/tasks', doctorTaskRoutes);
app.use('/api/doctor/patients', doctorPatientRoutes);
app.use('/api/doctor/wound-cases', doctorWoundCaseRoutes);
app.use('/api/doctor', doctorManagementRoutes);
app.use('/api/doctor/wound-details', doctorWoundDetailsRoutes);

// Start server
const syncOptions = process.env.DB_SYNC_ALTER === 'true' ? { alter: true } : {};

sequelize
  .sync(syncOptions)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to sync database:', error);
    process.exit(1);
  });
