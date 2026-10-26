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
    const error = new Error(data?.message || 'Request failed')
    error.fieldErrors = data?.errors ?? {}
    throw error
  }
  return data
}

export const getBankDashboard = () => request('/api/bank/dashboard')

export const getBankTransactions = ({ page = 1, search = '' } = {}) => {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  return request(`/api/bank/transactions?${params}`)
}

export const approveTransaction = (id) =>
  request(`/api/bank/transactions/${id}/approve`, { method: 'POST' })

export const getBankAgents = () => request('/api/bank/agents')

export const addAgent = (payload) =>
  request('/api/bank/agents', { method: 'POST', body: JSON.stringify(payload) })
