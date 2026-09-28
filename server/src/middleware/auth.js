// Authentication middleware
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_here_change_this_in_production', {
    expiresIn: '24h'
  });
};

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_here_change_this_in_production');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const authenticateTokenOrService = (req, res, next) => {
  const supplied = String(req.headers['x-internal-api-key'] || '');
  const expected = String(process.env.INTERNAL_API_KEY || '');
  if (supplied && expected) {
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);
    if (suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
      req.user = { role: 'service', service: 'lex-dss' };
      return next();
    }
  }
  return authenticateToken(req, res, next);
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || (req.user.role !== 'superadmin' && !roles.includes(req.user.role))) {
    return res.status(403).json({ error: 'Akses ditolak: hak akses tidak mencukupi' });
  }
  next();
};

export default { generateToken, authenticateToken, authenticateTokenOrService, requireRole };
