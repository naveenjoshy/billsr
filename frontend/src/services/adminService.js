import { post, request } from './apiClient'

export const getBanks = () => request('/api/admin/banks')

export const extendBankLicense = (id, body) =>
  post(`/api/admin/banks/${id}/extend`, body)

export const setBankSuspension = (id, suspend, justification) =>
  post(`/api/admin/banks/${id}/suspension`, { suspend, justification })

export const onboardBank = (payload) => post('/api/admin/banks', payload)

export const getGlobalAuditLogs = (params = {}) => {
  const query = new URLSearchParams()
  if (params.bankId) query.set('bankId', params.bankId)
  if (params.agentId) query.set('agentId', params.agentId)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  if (params.type && params.type !== 'all') query.set('type', params.type)
  if (params.search) query.set('search', params.search)
  const qs = query.toString()
  return request(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`)
}

export const getBankAgents = (bankId) =>
  request(`/api/admin/agents${bankId ? `?bankId=${bankId}` : ''}`)

export const getAgentCustomers = (agentId, bankId) => {
  const query = new URLSearchParams()
  if (agentId) query.set('agentId', agentId)
  if (bankId) query.set('bankId', bankId)
  const qs = query.toString()
  return request(`/api/admin/customers${qs ? `?${qs}` : ''}`)
}
