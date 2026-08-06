const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  event_type: { type: String, required: true }, // 'view', 'search', 'export', etc.
  entity_type: { type: String, required: true }, // 'rule', 'chart', 'graph'
  entity_id: { type: mongoose.Schema.Types.Mixed }, // Rule ID or other entity ID
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: mongoose.Schema.Types.Mixed,
  ip_address: String,
  user_agent: String,
  created_at: { type: Date, default: Date.now, index: true }
});

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;