import { request } from './apiClient'

export const getAgentHome = () => request('/api/agent/home')
