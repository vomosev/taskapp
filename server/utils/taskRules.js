'use strict';

const TASK_STATUSES = Object.freeze(['todo', 'in_progress', 'done']);
const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 5000;

function createValidationError(details) {
  const error = new Error('Validation failed');
  error.name = 'ValidationError';
  error.code = 'VALIDATION_ERROR';
  error.status = 400;
  error.statusCode = 400;
  error.details = details;
  return error;
}

function throwValidationError(details) {
  throw createValidationError(details);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function normalizeStatus(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeDueDate(value, field, errors) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  if (typeof value !== 'string' && !(value instanceof Date)) {
    errors.push({
      field,
      message: 'Due date must be a valid ISO date or null'
    });
    return null;
  }

  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value.trim());

  if (!Number.isFinite(date.getTime())) {
    errors.push({
      field,
      message: 'Due date must be a valid ISO date or null'
    });
    return null;
  }

  const year = date.getUTCFullYear();
  if (year < 1000 || year > 9999) {
    errors.push({
      field,
      message: 'Due date must be between the years 1000 and 9999'
    });
    return null;
  }

  return date.toISOString();
}

/**
 * Validate and normalize task input.
 *
 * By default this validates a complete task payload. Pass `{ partial: true }`
 * (or `true`) to validate only fields present in an update payload.
 */
function validateTaskInput(input, options = {}) {
  const partial = options === true || Boolean(options && options.partial);
  const errors = [];

  if (!isPlainObject(input)) {
    throwValidationError([
      {
        field: 'body',
        message: 'Task input must be a JSON object'
      }
    ]);
  }

  const normalized = {};
  const supportedFields = ['title', 'description', 'status', 'dueDate'];
  const providedFields = supportedFields.filter((field) => hasOwn(input, field));

  if (partial && providedFields.length === 0) {
    errors.push({
      field: 'body',
      message: 'At least one task field must be provided'
    });
  }

  if (!partial || hasOwn(input, 'title')) {
    if (typeof input.title !== 'string') {
      errors.push({
        field: 'title',
        message: 'Title is required and must be a string'
      });
    } else {
      const title = input.title.trim();

      if (title.length === 0) {
        errors.push({
          field: 'title',
          message: 'Title is required'
        });
      } else if (title.length > MAX_TITLE_LENGTH) {
        errors.push({
          field: 'title',
          message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer`
        });
      } else {
        normalized.title = title;
      }
    }
  }

  if (!partial || hasOwn(input, 'description')) {
    if (
      input.description !== undefined &&
      input.description !== null &&
      typeof input.description !== 'string'
    ) {
      errors.push({
        field: 'description',
        message: 'Description must be a string'
      });
    } else {
      const description =
        typeof input.description === 'string' ? input.description.trim() : '';

      if (description.length > MAX_DESCRIPTION_LENGTH) {
        errors.push({
          field: 'description',
          message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`
        });
      } else {
        normalized.description = description;
      }
    }
  }

  if (!partial || hasOwn(input, 'status')) {
    const status =
      input.status === undefined && !partial
        ? TASK_STATUSES[0]
        : normalizeStatus(input.status);

    if (typeof status !== 'string' || !TASK_STATUSES.includes(status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${TASK_STATUSES.join(', ')}`
      });
    } else {
      normalized.status = status;
    }
  }

  if (!partial || hasOwn(input, 'dueDate')) {
    normalized.dueDate = normalizeDueDate(
      input.dueDate,
      'dueDate',
      errors
    );
  }

  if (errors.length > 0) {
    throwValidationError(errors);
  }

  return normalized;
}

function validateTaskId(id, field, errors, seenIds) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    errors.push({
      field,
      message: 'Task ID must be a positive integer'
    });
    return false;
  }

  if (seenIds.has(id)) {
    errors.push({
      field,
      message: `Task ID ${id} appears more than once`
    });
    return false;
  }

  seenIds.add(id);
  return true;
}

function validateColumnPayload(columns, fieldPrefix) {
  const errors = [];
  const seenIds = new Set();
  const normalized = {};

  if (!isPlainObject(columns)) {
    throwValidationError([
      {
        field: fieldPrefix,
        message: 'Columns must be a JSON object'
      }
    ]);
  }

  for (const key of Object.keys(columns)) {
    if (!TASK_STATUSES.includes(key)) {
      errors.push({
        field: `${fieldPrefix}.${key}`,
        message: `Unknown task status "${key}"`
      });
    }
  }

  for (const status of TASK_STATUSES) {
    const field = `${fieldPrefix}.${status}`;
    const taskIds = columns[status];

    if (!Array.isArray(taskIds)) {
      errors.push({
        field,
        message: `The ${status} column must be an array of task IDs`
      });
      normalized[status] = [];
      continue;
    }

    normalized[status] = [];

    taskIds.forEach((id, index) => {
      if (validateTaskId(id, `${field}[${index}]`, errors, seenIds)) {
        normalized[status].push(id);
      }
    });
  }

  if (errors.length > 0) {
    throwValidationError(errors);
  }

  return normalized;
}

function validateUpdateList(updates, fieldPrefix) {
  const errors = [];
  const seenIds = new Set();
  const occupiedPositions = new Set();
  const normalized = [];

  if (!Array.isArray(updates)) {
    throwValidationError([
      {
        field: fieldPrefix,
        message: 'Task reorder entries must be an array'
      }
    ]);
  }

  updates.forEach((entry, index) => {
    const entryField = `${fieldPrefix}[${index}]`;

    if (!isPlainObject(entry)) {
      errors.push({
        field: entryField,
        message: 'Each reorder entry must be a JSON object'
      });
      return;
    }

    const idIsValid = validateTaskId(
      entry.id,
      `${entryField}.id`,
      errors,
      seenIds
    );
    const status = normalizeStatus(entry.status);
    let statusIsValid = true;
    let positionIsValid = true;

    if (typeof status !== 'string' || !TASK_STATUSES.includes(status)) {
      errors.push({
        field: `${entryField}.status`,
        message: `Status must be one of: ${TASK_STATUSES.join(', ')}`
      });
      statusIsValid = false;
    }

    if (!Number.isSafeInteger(entry.position) || entry.position < 0) {
      errors.push({
        field: `${entryField}.position`,
        message: 'Position must be a non-negative integer'
      });
      positionIsValid = false;
    }

    if (statusIsValid && positionIsValid) {
      const positionKey = `${status}:${entry.position}`;

      if (occupiedPositions.has(positionKey)) {
        errors.push({
          field: `${entryField}.position`,
          message: `Position ${entry.position} is duplicated in the ${status} column`
        });
        positionIsValid = false;
      } else {
        occupiedPositions.add(positionKey);
      }
    }

    if (idIsValid && statusIsValid && positionIsValid) {
      normalized.push({
        id: entry.id,
        status,
        position: entry.position
      });
    }
  });

  if (errors.length > 0) {
    throwValidationError(errors);
  }

  return normalized;
}

/**
 * Validate a Kanban reorder payload.
 *
 * Supported request shapes are:
 * - `{ columns: { todo: [1], in_progress: [2], done: [3] } }`
 * - `{ tasks: [{ id: 1, status: 'todo', position: 0 }] }`
 * - `{ updates: [{ id: 1, status: 'todo', position: 0 }] }`
 * - A direct columns object or direct update array.
 *
 * The normalized inner columns object or update array is returned.
 */
function validateReorderPayload(payload) {
  if (Array.isArray(payload)) {
    return validateUpdateList(payload, 'tasks');
  }

  if (!isPlainObject(payload)) {
    throwValidationError([
      {
        field: 'body',
        message: 'Reorder payload must be a JSON object'
      }
    ]);
  }

  if (hasOwn(payload, 'columns')) {
    return validateColumnPayload(payload.columns, 'columns');
  }

  if (hasOwn(payload, 'tasks')) {
    return validateUpdateList(payload.tasks, 'tasks');
  }

  if (hasOwn(payload, 'updates')) {
    return validateUpdateList(payload.updates, 'updates');
  }

  const keys = Object.keys(payload);
  if (
    keys.length > 0 &&
    keys.every((key) => TASK_STATUSES.includes(key))
  ) {
    return validateColumnPayload(payload, 'columns');
  }

  throwValidationError([
    {
      field: 'body',
      message: 'Reorder payload must contain columns or task updates'
    }
  ]);
}

module.exports = {
  TASK_STATUSES,
  ALLOWED_TASK_STATUSES: TASK_STATUSES,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  validateTaskInput,
  validateReorderPayload
};