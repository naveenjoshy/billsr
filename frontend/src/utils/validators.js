export const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/
export const HTTP_URL = /^https?:\/\/\S+$/i
export const USER_ID = /^[A-Za-z._-]+$/
export const NAME = /^[A-Za-z\s.'-]+$/

export function validateEmail(email) {
  const trimmed = String(email || '').trim()
  if (!trimmed) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return 'Email is invalid'
  }
  const atIndex = trimmed.indexOf('@')
  const localPart = trimmed.slice(0, atIndex)
  if (localPart.length < 3) {
    return 'Email must have at least 3 characters before the @ symbol'
  }
  if (/^\d+$/.test(localPart) || !/[a-zA-Z]/.test(localPart)) {
    return 'Email cannot be all numbers before the @ symbol'
  }
  return null
}

export function validateUserID(userID) {
  const trimmed = String(userID || '').trim()
  if (!trimmed) return 'User ID is required'
  if (/\d/.test(trimmed)) {
    return 'User ID cannot contain numbers'
  }
  if (trimmed.length < 3) {
    return 'User ID must be at least 3 characters'
  }
  if (trimmed.length > 40) {
    return 'User ID is too long'
  }
  if (!USER_ID.test(trimmed)) {
    return 'User ID may only contain letters, dot, dash, and underscore'
  }
  return null
}

export function validateName(name, label = 'Name') {
  const trimmed = String(name || '').trim()
  if (!trimmed) return `${label} is required`
  if (/\d/.test(trimmed)) {
    return `${label} cannot contain numbers`
  }
  if (trimmed.length < 2) {
    return `${label} must be at least 2 characters`
  }
  if (trimmed.length > 120) {
    return `${label} is too long`
  }
  if (!NAME.test(trimmed)) {
    return `${label} may only contain letters, spaces, hyphens, and apostrophes`
  }
  return null
}
