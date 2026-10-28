export const money = (value) => {
  const num = Number(value) || 0
  const formatted = `₹${Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
  return num < 0 ? `-${formatted}` : formatted
}

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

export const dateText = (value) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: 'UTC' })

export const licenseLabels = {
  active: 'License Active',
  expiring: 'License Expiring',
  grace: 'In Grace Period',
  suspended: 'License Suspended',
}
