let isRefreshing = false
let refreshSubscribers = []

function onRefreshed() {
  refreshSubscribers.forEach((cb) => cb(null))
  refreshSubscribers = []
}

function onRefreshFailed(err) {
  refreshSubscribers.forEach((cb) => cb(err))
  refreshSubscribers = []
}

export async function request(path, options = {}) {
  let response
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }
    response = await fetch(path, {
      credentials: 'include',
      ...options,
      headers,
    })
  } catch {
    throw new Error('Server unreachable')
  }

  // Automatic token refresh when 401 Unauthorized occurs on protected API endpoints
  if (
    response.status === 401 &&
    path !== '/api/auth/login' &&
    path !== '/api/auth/refresh' &&
    path !== '/api/auth/me' &&
    path !== '/api/auth/logout'
  ) {
    if (!isRefreshing) {
      isRefreshing = true
      try {
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        isRefreshing = false
        if (refreshResponse.ok) {
          onRefreshed()
          // Retry original request with newly issued access token
          return request(path, options)
        } else {
          onRefreshFailed(new Error('Session expired'))
        }
      } catch (err) {
        isRefreshing = false
        onRefreshFailed(err)
      }
    } else {
      // Return a Promise that resolves when the token has been refreshed
      return new Promise((resolve, reject) => {
        refreshSubscribers.push((err) => {
          if (err) reject(err)
          else request(path, options).then(resolve).catch(reject)
        })
      })
    }
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.message || 'Request failed')
    error.fieldErrors = data?.errors ?? {}
    error.status = response.status
    throw error
  }
  return data
}

export const post = (path, body, options = {}) =>
  request(path, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  })

export const patch = (path, body, options = {}) =>
  request(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    ...options,
  })

export const put = (path, body, options = {}) =>
  request(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    ...options,
  })

export const del = (path, options = {}) =>
  request(path, {
    method: 'DELETE',
    ...options,
  })
