const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PatientHandoff = sequelize.define(
  'PatientHandoff',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    from_nurse_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    to_nurse_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    patient_ids: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    pending_task_ids: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    general_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    per_patient_notes: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    shift_label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    shift_ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'ready', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft',
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    summary: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'patient_handoffs',
    underscored: true,
  }
);

module.exports = PatientHandoff;
