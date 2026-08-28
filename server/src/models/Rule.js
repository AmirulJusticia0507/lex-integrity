import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Rule = sequelize.define('Rule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  rule_code: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  regime: {
    type: DataTypes.STRING(100)
  },
  category: {
    type: DataTypes.STRING(50)
  },
  content: {
    type: DataTypes.TEXT
  },
  derived_rules: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  publish_date: {
    type: DataTypes.DATEONLY
  },
  source: {
    type: DataTypes.STRING(255)
  },
  pdf_url: {
    type: DataTypes.STRING(500)
  },
  slug: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  source_url: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  download_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  loopholes: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  impacts: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  sanctions: {
    type: DataTypes.JSONB,
    defaultValue: { administrative: '', criminal: '' }
  },
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  confidence_score: {
    type: DataTypes.DOUBLE,
    defaultValue: 0.85
  },
  processed_at: {
    type: DataTypes.DATE
  },
  processed_by: {
    type: DataTypes.STRING(100)
  },
  processing_method: {
    type: DataTypes.STRING(50)
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'rules',
  timestamps: false
});

export default Rule;
