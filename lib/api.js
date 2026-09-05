import { clearToken, getToken } from './auth';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
).replace(/\/+$/, '');

class ApiRequestError extends Error {
  constructor(message, { status = 0, details, cause } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;

    if (details !== undefined) {
      this.details = details;
    }

    if (cause !== undefined) {
      this.cause = cause;
    }

    this.response = {
      error: {
        message,
        ...(details !== undefined ? { details } : {}),
      },
    };
  }
}

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function shouldSerializeBody(body) {
  if (
    body === undefined ||
    body === null ||
    typeof body === 'string' ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  ) {
    return false;
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return false;
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return false;
  }

  return typeof body === 'object';
}

async function readResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiRequestError('The API returned an invalid JSON response.', {
      status: response.status,
    });
  }
}

export async function apiFetch(path, options = {}) {
  const {
    auth = true,
    headers: suppliedHeaders,
    body: suppliedBody,
    ...fetchOptions
  } = options;

  const headers = new Headers(suppliedHeaders || {});
  let body = suppliedBody;

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (shouldSerializeBody(body)) {
    body = JSON.stringify(body);

    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  if (auth) {
    const token = getToken();

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response;

  try {
    response = await fetch(buildUrl(path), {
      ...fetchOptions,
      headers,
      body,
    });
  } catch (error) {
    const message =
      error?.name === 'AbortError'
        ? 'The request was cancelled.'
        : 'Unable to connect to the API. Please try again.';

    throw new ApiRequestError(message, { cause: error });
  }

  const data = await readResponseBody(response);

  if (!response.ok) {
    if (auth && response.status === 401) {
      clearToken();
    }

    const message =
      data?.error?.message ||
      data?.message ||
      response.statusText ||
      'The API request failed.';
    const details = data?.error?.details ?? data?.details;

    throw new ApiRequestError(message, {
      status: response.status,
      details,
    });
  }

  return data;
}

export function signup(userData) {
  return apiFetch('/api/auth/signup', {
    method: 'POST',
    auth: false,
    body: userData,
  });
}

export function login(credentials) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: credentials,
  });
}

export function getCurrentUser() {
  return apiFetch('/api/auth/me', {
    method: 'GET',
    cache: 'no-store',
  });
}

export function listTasks() {
  return apiFetch('/api/tasks', {
    method: 'GET',
    cache: 'no-store',
  });
}

export function createTask(taskData) {
  return apiFetch('/api/tasks', {
    method: 'POST',
    body: taskData,
  });
}

export function updateTask(taskId, taskData) {
  return apiFetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PUT',
    body: taskData,
  });
}

export function deleteTask(taskId) {
  return apiFetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}

export function reorderTasks(reorderData) {
  return apiFetch('/api/tasks/reorder', {
    method: 'PATCH',
    body: reorderData,
  });
}