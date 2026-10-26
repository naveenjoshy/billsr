export const dateText = (value) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: 'UTC' })

export const licenseLabels = {
  active: 'License Active',
  expiring: 'License Expiring',
  grace: 'In Grace Period',
  suspended: 'License Suspended',
}
