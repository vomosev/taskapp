require('dotenv').config();

const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

const DATABASE = process.env.DB_NAME;
const USERNAME = process.env.DB_USER;
const PASSWORD = process.env.DB_PASSWORD;
const HOST = process.env.DB_HOST;

if (!DATABASE || !USERNAME || !HOST) {
  throw new Error(
    `Missing required DB environment variables. ` +
    `DB_NAME=${DATABASE}, DB_USER=${USERNAME}, DB_HOST=${HOST}`
  );
}

const sequelize = new Sequelize(DATABASE, USERNAME, PASSWORD, {
  host: HOST,
  dialect: 'mysql',
  logging: console.log,
  pool: { max: 5, min: 0, idle: 10000 },
  define: { timestamps: false }
});

sequelize.authenticate()
  .then(() => console.log('Connection has been established successfully.'))
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });

// ── Create the pool immediately — mysql2 pools don't open connections
// until a query is actually run, so this is safe to do at module load ──
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function verifyConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    console.log('Database connection verified.');
  } catch (error) {
    console.error('Error verifying database connection:', error);
    throw error;
  }
}

async function closePool() {
  await pool.end();
  console.log('Database connection pool closed.');
}

module.exports = {
  verifyConnection,
  closePool,
  sequelize,
  pool // ← now the actual mysql2 pool object, not a function
};