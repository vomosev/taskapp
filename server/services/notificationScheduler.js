const cron = require('node-cron');
const { pool } = require('../config/db');
const { sendTaskDueEmail } = require('./emailService');

const DEFAULT_NOTIFICATION_CRON = '*/5 * * * *';

let checkInProgress = false;
let scheduledJob = null;

function mapTask(row) {
  return {
    id: row.task_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    position: row.position,
    dueAt: row.due_at,
    notifiedAt: row.notified_at
  };
}

function mapUser(row, task) {
  return {
    id: row.user_id,
    name: row.user_name,
    email: row.user_email,
    to: row.user_email,
    userName: row.user_name,
    task,
    taskTitle: task.title,
    taskDescription: task.description,
    dueAt: task.dueAt
  };
}

async function processDueTask(taskId) {
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.execute(
      `SELECT
         t.id AS task_id,
         t.user_id,
         t.title,
         t.description,
         t.status,
         t.position,
         t.due_at,
         t.notified_at,
         u.name AS user_name,
         u.email AS user_email
       FROM tasks AS t
       INNER JOIN users AS u ON u.id = t.user_id
       WHERE t.id = ?
         AND t.status <> 'done'
         AND t.due_at IS NOT NULL
         AND t.due_at <= UTC_TIMESTAMP()
         AND t.notified_at IS NULL
       FOR UPDATE`,
      [taskId]
    );

    if (rows.length === 0) {
      await connection.commit();
      return false;
    }

    const row = rows[0];
    const task = mapTask(row);
    const user = mapUser(row, task);

    await sendTaskDueEmail(user, task);

    const [result] = await connection.execute(
      `UPDATE tasks
       SET notified_at = UTC_TIMESTAMP()
       WHERE id = ?
         AND status <> 'done'
         AND due_at IS NOT NULL
         AND due_at <= UTC_TIMESTAMP()
         AND notified_at IS NULL`,
      [taskId]
    );

    if (result.affectedRows !== 1) {
      throw new Error(`Task ${taskId} could not be marked as notified`);
    }

    await connection.commit();
    return true;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          `Failed to roll back notification transaction for task ${taskId}:`,
          rollbackError
        );
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}

async function checkDueTasks() {
  if (checkInProgress) {
    return {
      checked: 0,
      sent: 0,
      failed: 0,
      skipped: true
    };
  }

  checkInProgress = true;

  try {
    const [rows] = await pool.execute(
      `SELECT t.id
       FROM tasks AS t
       WHERE t.status <> 'done'
         AND t.due_at IS NOT NULL
         AND t.due_at <= UTC_TIMESTAMP()
         AND t.notified_at IS NULL
       ORDER BY t.due_at ASC, t.id ASC`
    );

    const result = {
      checked: rows.length,
      sent: 0,
      failed: 0,
      skipped: false
    };

    for (const row of rows) {
      try {
        const sent = await processDueTask(row.id);

        if (sent) {
          result.sent += 1;
        }
      } catch (error) {
        result.failed += 1;
        console.error(
          `Failed to send due-task notification for task ${row.id}; it will be retried:`,
          error
        );
      }
    }

    return result;
  } finally {
    checkInProgress = false;
  }
}

function startDueNotificationScheduler() {
  if (scheduledJob) {
    return scheduledJob;
  }

  const schedule = (
    process.env.NOTIFICATION_POLL_CRON || DEFAULT_NOTIFICATION_CRON
  ).trim();

  if (!cron.validate(schedule)) {
    throw new Error(
      `Invalid NOTIFICATION_POLL_CRON expression: "${schedule}"`
    );
  }

  scheduledJob = cron.schedule(schedule, async () => {
    try {
      await checkDueTasks();
    } catch (error) {
      console.error('Due-task notification check failed:', error);
    }
  });

  checkDueTasks().catch((error) => {
    console.error('Initial due-task notification check failed:', error);
  });

  return scheduledJob;
}

module.exports = {
  checkDueTasks,
  startDueNotificationScheduler
};