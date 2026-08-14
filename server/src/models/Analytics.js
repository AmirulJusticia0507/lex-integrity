const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('lex_integrity', 'postgres', 'admin123', {
  host: 'localhost',
  dialect: 'postgres',
  port: 5432,
  logging: false
});

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
    type: DataTypes.INTEGER // Assuming entity_id refers to Rule ID
  },
  user_id: { type: DataTypes.INTEGER },
  metadata: DataTypes.JSONB,
  ip_address: DataTypes.STRING(45),
  user_agent: DataTypes.TEXT,
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'analytics',
  timestamps: false
});

Analytics.sync()
  .then(() => console.log('Analytics table synced'))
  .catch(err => console.error('Sync error:', err));

module.exports = Analytics;