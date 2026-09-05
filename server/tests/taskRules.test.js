const {
  validateTaskInput,
  validateReorderPayload,
} = require('../utils/taskRules');

function hasEntries(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(
    value &&
      typeof value === 'object' &&
      Object.keys(value).length > 0
  );
}

function runValidation(validator, payload, ...args) {
  try {
    const result = validator(payload, ...args);

    const invalid =
      result === false ||
      result == null ||
      result?.valid === false ||
      result?.isValid === false ||
      Boolean(result?.error) ||
      hasEntries(result?.errors);

    return {
      valid: !invalid,
      result,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      result: null,
      error,
    };
  }
}

function unwrapValue(result) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  if (Object.prototype.hasOwnProperty.call(result, 'value')) {
    return result.value;
  }

  if (Object.prototype.hasOwnProperty.call(result, 'normalized')) {
    return result.normalized;
  }

  if (Object.prototype.hasOwnProperty.call(result, 'data')) {
    return result.data;
  }

  return result;
}

function validationErrorText(outcome) {
  const parts = [];

  if (outcome.error) {
    parts.push(outcome.error.message);

    if (outcome.error.details) {
      parts.push(JSON.stringify(outcome.error.details));
    }

    if (outcome.error.errors) {
      parts.push(JSON.stringify(outcome.error.errors));
    }
  }

  if (outcome.result) {
    if (outcome.result.error) {
      parts.push(JSON.stringify(outcome.result.error));
    }

    if (outcome.result.errors) {
      parts.push(JSON.stringify(outcome.result.errors));
    }

    if (outcome.result.details) {
      parts.push(JSON.stringify(outcome.result.details));
    }
  }

  return parts.filter(Boolean).join(' ').toLowerCase();
}

function expectInvalid(validator, payload, expectedMessage, ...args) {
  const outcome = runValidation(validator, payload, ...args);

  expect(outcome.valid).toBe(false);
  expect(validationErrorText(outcome)).toMatch(expectedMessage);

  return outcome;
}

describe('validateTaskInput', () => {
  test('normalizes a valid task', () => {
    const dueAt = '2030-05-20T14:30:00.000Z';
    const outcome = runValidation(validateTaskInput, {
      title: '  Prepare release  ',
      description: '  Verify the migration plan.  ',
      status: 'in_progress',
      dueAt,
    });

    expect(outcome.valid).toBe(true);

    const task = unwrapValue(outcome.result);

    expect(task).toEqual(
      expect.objectContaining({
        title: 'Prepare release',
        description: 'Verify the migration plan.',
        status: 'in_progress',
      })
    );
    expect(new Date(task.dueAt).toISOString()).toBe(dueAt);
  });

  test('accepts every Kanban status and a null due date', () => {
    for (const status of ['todo', 'in_progress', 'done']) {
      const outcome = runValidation(validateTaskInput, {
        title: 'Valid task',
        description: '',
        status,
        dueAt: null,
      });

      expect(outcome.valid).toBe(true);
      expect(unwrapValue(outcome.result).status).toBe(status);
      expect(unwrapValue(outcome.result).dueAt).toBeNull();
    }
  });

  test('rejects an unsupported status', () => {
    expectInvalid(
      validateTaskInput,
      {
        title: 'Invalid status task',
        description: '',
        status: 'blocked',
        dueAt: null,
      },
      /status/
    );
  });

  test.each([
    'not-a-date',
    '2028-13-45T25:90:00.000Z',
  ])('rejects the invalid due date %s', (dueAt) => {
    expectInvalid(
      validateTaskInput,
      {
        title: 'Invalid date task',
        description: '',
        status: 'todo',
        dueAt,
      },
      /due|date/
    );
  });

  test.each([
    {},
    { title: '' },
    { title: '   ' },
    { title: null },
  ])('requires a non-empty title for %p', (task) => {
    expectInvalid(
      validateTaskInput,
      {
        description: '',
        status: 'todo',
        dueAt: null,
        ...task,
      },
      /title/
    );
  });

  test('rejects a title longer than 255 characters', () => {
    expectInvalid(
      validateTaskInput,
      {
        title: 't'.repeat(256),
        description: '',
        status: 'todo',
        dueAt: null,
      },
      /title/
    );
  });

  test('rejects a description longer than 5000 characters', () => {
    expectInvalid(
      validateTaskInput,
      {
        title: 'Valid title',
        description: 'd'.repeat(5001),
        status: 'todo',
        dueAt: null,
      },
      /description/
    );
  });
});

describe('validateReorderPayload', () => {
  const validColumns = {
    todo: [3, 1],
    in_progress: [2],
    done: [5, 4],
  };

  test('accepts and preserves a valid Kanban column ordering', () => {
    const outcome = runValidation(validateReorderPayload, {
      columns: validColumns,
    });

    expect(outcome.valid).toBe(true);

    const normalized = unwrapValue(outcome.result);
    const columns = normalized.columns || normalized;

    expect(columns).toEqual(validColumns);
  });

  test('rejects a task ID duplicated within one column', () => {
    expectInvalid(
      validateReorderPayload,
      {
        columns: {
          todo: [1, 1],
          in_progress: [2],
          done: [],
        },
      },
      /duplicate|unique|more than once/
    );
  });

  test('rejects a task ID duplicated across columns', () => {
    expectInvalid(
      validateReorderPayload,
      {
        columns: {
          todo: [1],
          in_progress: [2, 1],
          done: [],
        },
      },
      /duplicate|unique|more than once/
    );
  });

  test.each([
    ['a string ID', '1'],
    ['zero', 0],
    ['a negative ID', -2],
    ['a decimal ID', 1.5],
    ['a null ID', null],
    ['an object ID', { id: 1 }],
  ])('rejects %s in a task ID list', (_description, taskId) => {
    expectInvalid(
      validateReorderPayload,
      {
        columns: {
          todo: [taskId],
          in_progress: [],
          done: [],
        },
      },
      /id|task|todo|column/
    );
  });
});