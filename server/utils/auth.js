const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const BCRYPT_ROUNDS = 12;

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string');
  }

  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, passwordHash) {
  if (
    typeof password !== 'string' ||
    typeof passwordHash !== 'string' ||
    passwordHash.length === 0
  ) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

function signToken(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function verifyToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
};