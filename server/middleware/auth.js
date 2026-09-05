const { pool } = require('../config/db');
const { verifyToken } = require('../utils/auth');

function unauthorized(res) {
  return res.status(401).json({
    error: {
      message: 'Authentication required',
    },
  });
}

async function requireAuth(req, res, next) {
  const authorization = req.get('authorization');

  if (typeof authorization !== 'string') {
    return unauthorized(res);
  }

  const match = authorization.match(/^Bearer\s+(\S+)\s*$/i);

  if (!match) {
    return unauthorized(res);
  }

  let payload;

  try {
    payload = verifyToken(match[1]);
  } catch (error) {
    return unauthorized(res);
  }

  const userId = Number(payload && (payload.id ?? payload.userId));

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return unauthorized(res);
  }

  try {
    const poolInstance = typeof pool === 'function' ? pool() : pool;
    const [rows] = await poolInstance.execute(
      'SELECT id, name, email FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (rows.length === 0) {
      return unauthorized(res);
    }

    const user = rows[0];

    req.user = {
      id: Number(user.id),
      name: user.name,
      email: user.email,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requireAuth,
};