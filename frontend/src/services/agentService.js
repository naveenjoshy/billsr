import { request } from './apiClient'

export const getAgentHome = () => request('/api/agent/home')
export const createAgentTransaction = (data) =>
  request('/api/agent/transact', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const onboardCustomer = (data) =>
  request('/api/agent/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const requestTransactionCancellation = (id, reason) =>
  request(`/api/agent/transactions/${id}/cancel-request`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const withdrawCancellationRequest = (id) =>
  request(`/api/agent/transactions/${id}/withdraw-cancel`, {
    method: 'POST',
  })
