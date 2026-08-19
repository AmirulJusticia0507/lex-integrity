const sequelize = require('../config/database');
const Rule = require('./Rule');
const User = require('./User');
const Analytics = require('./Analytics');
const Role = require('./Role');

module.exports = {
  sequelize,
  Rule,
  User,
  Analytics,
  Role
};
