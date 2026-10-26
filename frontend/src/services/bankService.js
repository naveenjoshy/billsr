import { del, post, put, request } from './apiClient'

export const getBankDashboard = (query = {}) => {
  const params = new URLSearchParams()
  if (query.date) params.set('date', query.date)
  const qs = params.toString()
  return request(`/api/bank/dashboard${qs ? `?${qs}` : ''}`)
}

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
  post(`/api/bank/transactions/${id}/cancel`, { reason })

export const rejectBankCancellation = (id) =>
  post(`/api/bank/transactions/${id}/reject-cancellation`, {})

export const approveTransaction = (id) =>
  post(`/api/bank/transactions/${id}/approve`, {})

export const getBankAgents = () => request('/api/bank/agents')

export const addAgent = (payload) => post('/api/bank/agents', payload)

export const getBankSchemes = () => request('/api/bank/schemes')

export const createBankScheme = (payload) => post('/api/bank/schemes', payload)

export const updateBankScheme = (id, payload) => put(`/api/bank/schemes/${id}`, payload)

export const deleteBankScheme = (id) => del(`/api/bank/schemes/${id}`)
