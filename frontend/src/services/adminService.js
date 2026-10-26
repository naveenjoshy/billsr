import { post, request } from './apiClient'

export const getBanks = () => request('/api/admin/banks')

export const extendBankLicense = (id, body) =>
  post(`/api/admin/banks/${id}/extend`, body)

export const setBankSuspension = (id, suspend, justification) =>
  post(`/api/admin/banks/${id}/suspension`, { suspend, justification })

export const onboardBank = (payload) => post('/api/admin/banks', payload)
