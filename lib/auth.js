const TOKEN_KEY = "taskapp_token";

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  try {
    const token = storage.getItem(TOKEN_KEY);
    return token && token.trim() ? token : null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  if (typeof token !== "string" || !token.trim()) {
    return clearToken();
  }

  try {
    storage.setItem(TOKEN_KEY, token.trim());
    return true;
  } catch {
    return false;
  }
}

export function clearToken() {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isAuthenticated() {
  return Boolean(getToken());
}