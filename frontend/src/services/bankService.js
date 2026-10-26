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

export const getBankTransactions = (query = {}) => {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.search) params.set('search', query.search)
  if (query.status && query.status !== 'all') params.set('status', query.status)
  if (query.type && query.type !== 'all') params.set('type', query.type)
  if (query.mode && query.mode !== 'all') params.set('mode', query.mode)
  if (query.scheme && query.scheme !== 'all') params.set('scheme', query.scheme)
  if (query.agent && query.agent !== 'all') params.set('agent', query.agent)
  if (query.dateRange && query.dateRange !== 'all') params.set('dateRange', query.dateRange)
  return request(`/api/bank/transactions?${params.toString()}`)
}

export const cancelBankTransaction = (id, reason) =>
  request(`/api/bank/transactions/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const rejectBankCancellation = (id) =>
  request(`/api/bank/transactions/${id}/reject-cancellation`, {
    method: 'POST',
  })

export const approveTransaction = (id) =>
  request(`/api/bank/transactions/${id}/approve`, { method: 'POST' })

export const getBankAgents = () => request('/api/bank/agents')

export const addAgent = (payload) =>
  request('/api/bank/agents', { method: 'POST', body: JSON.stringify(payload) })
