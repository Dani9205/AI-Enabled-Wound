const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Task = sequelize.define(
  'Task',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    task_type: {
      type: DataTypes.ENUM('all', 'wound', 'documentation', 'follow_up', 'other'),
      allowNull: false,
      defaultValue: 'other',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'medium',
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    patient_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'patients',
        key: 'id',
      },
    },
    wound_case: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    assigned_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    assigned_to: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    due_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    task_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    work_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'tasks',
    underscored: true,
  }
);

module.exports = Task;
