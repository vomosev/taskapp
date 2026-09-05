'use strict';

const { pool } = require('../config/db');
const {
  hashPassword,
  verifyPassword,
  signToken,
} = require('../utils/auth');

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 255;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function validateSignupInput(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const details = [];

  if (!name) {
    details.push({ field: 'name', message: 'Name is required.' });
  } else if (name.length > NAME_MAX_LENGTH) {
    details.push({
      field: 'name',
      message: `Name must be ${NAME_MAX_LENGTH} characters or fewer.`,
    });
  }

  if (!email) {
    details.push({ field: 'email', message: 'Email is required.' });
  } else if (
    email.length > EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    details.push({
      field: 'email',
      message: 'A valid email address is required.',
    });
  }

  if (!password) {
    details.push({ field: 'password', message: 'Password is required.' });
  } else if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    details.push({
      field: 'password',
      message: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
    });
  }

  return {
    values: { name, email, password },
    details,
  };
}

function validateLoginInput(body) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const details = [];

  if (!email) {
    details.push({ field: 'email', message: 'Email is required.' });
  } else if (
    email.length > EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    details.push({
      field: 'email',
      message: 'A valid email address is required.',
    });
  }

  if (!password) {
    details.push({ field: 'password', message: 'Password is required.' });
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    details.push({
      field: 'password',
      message: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
    });
  }

  return {
    values: { email, password },
    details,
  };
}

function sendValidationError(res, details) {
  return res.status(400).json({
    error: {
      message: 'Validation failed.',
      details,
    },
  });
}

async function signup(req, res, next) {
  try {
    const { values, details } = validateSignupInput(req.body || {});

    if (details.length > 0) {
      return sendValidationError(res, details);
    }

    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [values.email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: {
          message: 'An account with this email already exists.',
          details: [
            {
              field: 'email',
              message: 'This email address is already registered.',
            },
          ],
        },
      });
    }

    const passwordHash = await hashPassword(values.password);

    let result;
    try {
      [result] = await pool.execute(
        `INSERT INTO users (name, email, password_hash)
         VALUES (?, ?, ?)`,
        [values.name, values.email, passwordHash]
      );
    } catch (error) {
      if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
        return res.status(409).json({
          error: {
            message: 'An account with this email already exists.',
            details: [
              {
                field: 'email',
                message: 'This email address is already registered.',
              },
            ],
          },
        });
      }

      throw error;
    }

    const user = {
      id: result.insertId,
      name: values.name,
      email: values.email,
    };
    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    return res.status(201).json({
      token,
      user: safeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { values, details } = validateLoginInput(req.body || {});

    if (details.length > 0) {
      return sendValidationError(res, details);
    }

    const [rows] = await pool.execute(
      `SELECT id, name, email, password_hash AS passwordHash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [values.email]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Invalid email or password.',
        },
      });
    }

    const passwordMatches = await verifyPassword(
      values.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: {
          message: 'Invalid email or password.',
        },
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    return res.status(200).json({
      token,
      user: safeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: {
          message: 'Authentication required.',
        },
      });
    }

    const [rows] = await pool.execute(
      `SELECT id, name, email
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: {
          message: 'Authentication required.',
        },
      });
    }

    return res.status(200).json({
      user: safeUser(rows[0]),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  signup,
  login,
  me,
};