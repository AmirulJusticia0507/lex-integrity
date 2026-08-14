const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('lex_integrity', 'postgres', 'admin123', {
  host: 'localhost',
  dialect: 'postgres',
  port: 5432,
  logging: false
});

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(200),
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'user'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'users',
  timestamps: false
});

User.sync()
  .then(() => console.log('User table synced'))
  .catch(err => console.error('Sync error:', err));

module.exports = User;