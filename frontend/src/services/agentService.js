export async function getAgentHome() {
  let response
  try {
    response = await fetch('/api/agent/home', { credentials: 'include' })
  } catch {
    throw new Error('Server unreachable')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message || 'Unable to load your dashboard')
  return data
}
