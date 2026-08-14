const sequelize = require('../config/database');
const Rule = require('./Rule');
const User = require('./User');
const Analytics = require('./Analytics');

module.exports = {
  sequelize,
  Rule,
  User,
  Analytics
};
