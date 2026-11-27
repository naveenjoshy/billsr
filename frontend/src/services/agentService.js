import { request } from './apiClient'

export const getAgentHome = () => request('/api/agent/home')
export const createAgentTransaction = (data) =>
  request('/api/agent/transact', {
    method: 'POST',
    body: JSON.stringify(data),
  })
