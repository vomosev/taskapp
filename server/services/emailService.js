'use strict';

const nodemailer = require('nodemailer');

function parseBoolean(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

const configuredPort = Number(process.env.SMTP_PORT || 587);
const hasValidPort =
  Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535;

const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPassword = String(process.env.SMTP_PASSWORD || '');

const transportOptions = {
  host: String(process.env.SMTP_HOST || '').trim() || 'localhost',
  port: hasValidPort ? configuredPort : 587,
  secure: parseBoolean(process.env.SMTP_SECURE),
};

if (smtpUser && smtpPassword) {
  transportOptions.auth = {
    user: smtpUser,
    pass: smtpPassword,
  };
}

const transporter = nodemailer.createTransport(transportOptions);

function assertEmailConfiguration() {
  if (!String(process.env.SMTP_HOST || '').trim()) {
    throw new Error('SMTP_HOST is required to send task due emails');
  }

  if (!hasValidPort) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }

  if ((smtpUser && !smtpPassword) || (!smtpUser && smtpPassword)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must both be provided when using SMTP authentication');
  }

  if (!String(process.env.SMTP_FROM || '').trim()) {
    throw new Error('SMTP_FROM is required to send task due emails');
  }
}

function normalizePlainText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function normalizeSingleLine(value, fallback = '') {
  return normalizePlainText(value, fallback).replace(/\s*\n+\s*/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDueDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Cannot send a due-task email without a valid due date');
  }

  const isoDate = date.toISOString();
  const readableDate = isoDate
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');

  return {
    isoDate,
    readableDate,
  };
}

function resolveEmailData(user, task) {
  const taskData = task || user || {};
  const userData = task
    ? user || {}
    : taskData.user || {
        name: taskData.userName || taskData.user_name,
        email: taskData.userEmail || taskData.user_email,
      };

  const recipient = normalizeSingleLine(
    userData.email || userData.user_email || taskData.userEmail || taskData.user_email
  );

  if (!recipient || /[\r\n]/.test(recipient)) {
    throw new Error('Cannot send a due-task email without a valid recipient address');
  }

  const name = normalizeSingleLine(
    userData.name || userData.user_name || taskData.userName || taskData.user_name,
    'there'
  );
  const title = normalizeSingleLine(taskData.title);

  if (!title) {
    throw new Error('Cannot send a due-task email without a task title');
  }

  const description =
    normalizePlainText(taskData.description) || 'No description provided.';
  const status = normalizeSingleLine(taskData.status);
  const dueValue =
    taskData.dueDate ??
    taskData.due_at ??
    taskData.dueAt ??
    taskData.due_date;

  return {
    recipient,
    name,
    title,
    description,
    status,
    due: formatDueDate(dueValue),
  };
}

async function sendTaskDueEmail(user, task) {
  assertEmailConfiguration();

  const { recipient, name, title, description, status, due } = resolveEmailData(user, task);
  const from = normalizeSingleLine(process.env.SMTP_FROM);

  if (!from || /[\r\n]/.test(from)) {
    throw new Error('SMTP_FROM must be a valid single-line email address');
  }

  const statusLine = status ? `Status: ${status}\n` : '';
  const htmlStatus = status
    ? `<p style="margin:0 0 8px;"><strong>Status:</strong> ${escapeHtml(status)}</p>`
    : '';

  const text = [
    `Hello ${name},`,
    '',
    'This is a reminder that the following task is due:',
    '',
    `Task: ${title}`,
    `Description: ${description}`,
    statusLine.trimEnd(),
    `Due: ${due.readableDate}`,
    '',
    'Please review the task in Taskapp.',
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f6f8;color:#1f2937;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <p style="margin:0 0 16px;">Hello ${escapeHtml(name)},</p>
      <p style="margin:0 0 20px;">This is a reminder that the following task is due:</p>
      <div style="padding:16px;background:#f9fafb;border-left:4px solid #2563eb;border-radius:4px;">
        <p style="margin:0 0 8px;"><strong>Task:</strong> ${escapeHtml(title)}</p>
        <p style="margin:0 0 8px;"><strong>Description:</strong><br>${escapeHtml(description).replace(/\n/g, '<br>')}</p>
        ${htmlStatus}
        <p style="margin:0;"><strong>Due:</strong> <time datetime="${escapeHtml(due.isoDate)}">${escapeHtml(due.readableDate)}</time></p>
      </div>
      <p style="margin:20px 0 0;">Please review the task in Taskapp.</p>
    </div>
  </body>
</html>`;

  return transporter.sendMail({
    from,
    to: recipient,
    subject: `Task due: ${title}`,
    text,
    html,
  });
}

module.exports = {
  sendTaskDueEmail,
};