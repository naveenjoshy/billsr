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
  if (!response.ok) throw new Error(data?.message || 'Request failed')
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
