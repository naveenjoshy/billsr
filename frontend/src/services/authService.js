import { patch, post } from './apiClient'

export async function loginUser(email, password) {
  const data = await post('/api/auth/login', { email, password })
  if (!data?.user) throw new Error('Invalid response from server')
  return data.user
}

export async function getCurrentUser() {
  let response
  try {
    response = await fetch('/api/auth/me', { credentials: 'include' })
  } catch {
    throw new Error('Unable to verify the current session. Please sign in.')
  }

  if (response.status === 401) return null

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message || 'Unable to verify the current session. Please sign in.')
  }
  if (!data?.user) throw new Error('Invalid response from server')
  return data.user
}

export const verifyPasswordReset = (email, userID) =>
  post('/api/auth/password-reset/verify', { email, userID })

export const resetPassword = (email, userID, newPassword, confirmPassword) =>
  post('/api/auth/password-reset', { email, userID, newPassword, confirmPassword })

export const logoutUser = () => post('/api/auth/logout', {})

export async function updateProfile(payload) {
  const data = await patch('/api/auth/profile', payload)
  return data.user
}

export async function setFirstPassword(newPassword, confirmPassword) {
  const data = await post('/api/auth/first-login-password', { newPassword, confirmPassword })
  return data.user
}
