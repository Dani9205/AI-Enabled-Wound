const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WoundCase = sequelize.define(
  'WoundCase',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    patient_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'id',
      },
    },
    wound_type: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    severity_stage: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    pain_score: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    body_location: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    wound_etiology: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'monitoring', 'healing', 'healed', 'closed'),
      allowNull: false,
      defaultValue: 'active',
    },
    healing_progress: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    length_cm: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    width_cm: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    depth_cm: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    measurements: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    updates: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    clinical_notes: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    reports: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'wound_cases',
    underscored: true,
  }
);

module.exports = WoundCase;
