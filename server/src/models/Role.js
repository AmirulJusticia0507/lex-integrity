import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'roles',
  timestamps: false
});

export default Role;