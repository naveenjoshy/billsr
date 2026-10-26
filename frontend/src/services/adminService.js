async function request(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('Server unreachable')
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message || 'Request failed')
  }
  return data
}

const post = (path, body) =>
  request(path, { method: 'POST', body: JSON.stringify(body) })

export const getBanks = () => request('/api/admin/banks')

export const extendBankLicense = (id, body) =>
  post(`/api/admin/banks/${id}/extend`, body)

export const setBankSuspension = (id, suspend, justification) =>
  post(`/api/admin/banks/${id}/suspension`, { suspend, justification })

export async function onboardBank(payload) {
  let response
  try {
    response = await fetch('/api/admin/banks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Server unreachable')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.message || 'Request failed')
    error.fieldErrors = data?.errors ?? {}
    throw error
  }
  return data
}
