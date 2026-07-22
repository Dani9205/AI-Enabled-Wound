const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Patient = sequelize.define(
  'Patient',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    nurse_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    doctor_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true,
    },
    mrn: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone_number: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    room: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    wound_type: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    primary_staff: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    backup_staff: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    primary_diagnosis: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    allergies_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
    archived_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    archived_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    tableName: 'patients',
    underscored: true,
    indexes: [
      { fields: ['nurse_id'] },
      { fields: ['doctor_id'] },
      { fields: ['mrn'], unique: true },
      { fields: ['status'] },
    ],
  }
);

module.exports = Patient;
