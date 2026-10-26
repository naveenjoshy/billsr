export async function loginUser(email, password) {
  let response;

  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('Server unreachable');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response from server');
  }

  if (!response.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : 'Unable to authenticate. Please check your credentials.',
    );
  }

  if (!data.user || typeof data.user !== 'object') {
    throw new Error('Invalid response from server');
  }

  return data.user;
}

export async function getCurrentUser() {
  let response;

  try {
    response = await fetch('/api/auth/me', { credentials: 'include' });
  } catch {
    throw new Error('Unable to verify the current session. Please sign in.');
  }

  if (response.status === 401) {
    return null;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }

  if (!response.ok) {
    throw new Error(
      typeof data?.message === 'string'
        ? data.message
        : 'Unable to verify the current session. Please sign in.',
    );
  }

  if (!data || typeof data !== 'object' || !data.user || typeof data.user !== 'object') {
    throw new Error('Invalid response from server');
  }

  return data.user;
}

async function passwordResetRequest(path, payload) {
  let response;

  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Server unreachable. Please try again.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }

  if (!response.ok) {
    throw new Error(
      typeof data?.message === 'string'
        ? data.message
        : 'Unable to reset the password. Please try again.',
    );
  }

  return data;
}

export async function verifyPasswordReset(email, userID) {
  return passwordResetRequest('/api/auth/password-reset/verify', {
    email,
    userID,
  });
}

export async function resetPassword(email, userID, newPassword, confirmPassword) {
  return passwordResetRequest('/api/auth/password-reset', {
    email,
    userID,
    newPassword,
    confirmPassword,
  });
}
