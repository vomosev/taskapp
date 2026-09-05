require('dotenv').config();

const https = require('https');
const { readFile } = require('fs/promises');

const app = require('./app');
const { verifyConnection, closePool } = require('./config/db');
const {
  startDueNotificationScheduler,
} = require('./services/notificationScheduler');

const DEFAULT_PORT = 4000;
const SHUTDOWN_TIMEOUT_MS = 10000;
const CERTIFICATE_PATH =
  '/home/arx-app/backends/taskapp/certs/certificate.crt';
const PRIVATE_KEY_PATH = '/home/arx-app/backends/taskapp/certs/private.key';

let server = null;
let notificationScheduler = null;
let shuttingDown = false;

function getPort() {
  const value = process.env.APP_PORT;

  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('APP_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

async function getTlsOptions() {
  const [cert, key] = await Promise.all([
    readFile(CERTIFICATE_PATH),
    readFile(PRIVATE_KEY_PATH),
  ]);

  return { cert, key };
}

function listen(appInstance, port, tlsOptions) {
  return new Promise((resolve, reject) => {
    const httpsServer = https.createServer(tlsOptions, appInstance);

    const handleError = (error) => {
      httpsServer.removeListener('listening', handleListening);
      reject(error);
    };

    const handleListening = () => {
      httpsServer.removeListener('error', handleError);
      resolve(httpsServer);
    };

    httpsServer.once('error', handleError);
    httpsServer.once('listening', handleListening);
    httpsServer.listen(port);
  });
}

function stopScheduler() {
  if (!notificationScheduler) {
    return;
  }

  if (typeof notificationScheduler.stop === 'function') {
    notificationScheduler.stop();
  }

  if (typeof notificationScheduler.destroy === 'function') {
    notificationScheduler.destroy();
  }

  notificationScheduler = null;
}

function closeServer() {
  if (!server || !server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeout);
      resolve();
    };

    const timeout = setTimeout(() => {
      console.warn('HTTPS server shutdown timed out; closing active connections.');

      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }

      finish();
    }, SHUTDOWN_TIMEOUT_MS);

    timeout.unref();

    server.close((error) => {
      if (error) {
        console.error('Error while closing the HTTPS server:', error);
      }

      finish();
    });

    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
  });
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) {
    console.error(`Received ${signal} while shutting down; exiting immediately.`);
    process.exit(exitCode || 1);
  }

  shuttingDown = true;
  console.log(`Received ${signal}. Shutting down gracefully...`);

  try {
    stopScheduler();
  } catch (error) {
    console.error('Error while stopping the notification scheduler:', error);
    exitCode = 1;
  }

  try {
    await closeServer();
  } catch (error) {
    console.error('Error while closing the HTTPS server:', error);
    exitCode = 1;
  }

  try {
    await closePool();
  } catch (error) {
    console.error('Error while closing the MySQL connection pool:', error);
    exitCode = 1;
  }

  process.exit(exitCode);
}

async function start() {
  const port = getPort();
  const tlsOptions = await getTlsOptions();

  await verifyConnection();
  console.log('MySQL connection verified.');

  server = await listen(app, port, tlsOptions);
  console.log(`Taskapp API listening securely on port ${port}.`);

  notificationScheduler = startDueNotificationScheduler();
  console.log('Due-task notification scheduler started.');
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

start().catch((error) => {
  console.error('Failed to start Taskapp API:', error);

  if (!shuttingDown) {
    void shutdown('startup failure', 1);
  }
});