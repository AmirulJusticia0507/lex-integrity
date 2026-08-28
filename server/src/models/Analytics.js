import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Analytics = sequelize.define('Analytics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  entity_id: {
    type: DataTypes.INTEGER
  },
  user_id: {
    type: DataTypes.INTEGER
  },
  metadata: {
    type: DataTypes.JSONB
  },
  ip_address: {
    type: DataTypes.STRING(45)
  },
  user_agent: {
    type: DataTypes.TEXT
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'analytics',
  timestamps: false
});

export default Analytics;
