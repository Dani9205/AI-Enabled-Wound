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
  },
  {
    tableName: 'patients',
    underscored: true,
  }
);

module.exports = Patient;
