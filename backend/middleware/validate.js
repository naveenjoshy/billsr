const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const MARKUP = /<[^>]*>|[<>]/g
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const OBJECT_KEYS_DENIED = /^\$|\./

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export function sanitizeText(value) {
  return value.replace(CONTROL_CHARS, '').replace(MARKUP, '').replace(/\s+/g, ' ').trim()
}

// Reads type, required flag, enum and casing rules straight from the Mongoose schema.
function fieldFromSchema(model, path, overrides = {}) {
  const schemaType = model.schema.path(path)
  if (!schemaType) throw new Error(`${model.modelName} has no path "${path}"`)
  return {
    type: schemaType.instance,
    required: Boolean(schemaType.isRequired),
    enum: schemaType.enumValues?.length ? schemaType.enumValues : undefined,
    lowercase: Boolean(schemaType.options?.lowercase),
    ...overrides,
  }
}

function coerce(name, field, raw) {
  switch (field.type) {
    case 'String': {
      if (typeof raw !== 'string') throw new Error(`${name} must be text`)
      const value = sanitizeText(raw)
      const result = field.lowercase ? value.toLowerCase() : value
      if (field.enum && !field.enum.includes(result)) {
        throw new Error(`${name} must be one of: ${field.enum.join(', ')}`)
      }
      if (field.pattern && !field.pattern.test(result)) {
        throw new Error(field.message || `${name} is invalid`)
      }
      if (field.min && result.length < field.min) throw new Error(`${name} is too short`)
      if (field.max && result.length > field.max) throw new Error(`${name} is too long`)
      return result
    }
    case 'Date': {
      if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
        throw new Error(`${name} must be a date in YYYY-MM-DD format`)
      }
      const date = new Date(`${raw.trim()}T00:00:00.000Z`)
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw.trim()) {
        throw new Error(`${name} is not a valid date`)
      }
      return date
    }
    case 'Boolean':
      if (typeof raw !== 'boolean') throw new Error(`${name} must be true or false`)
      return raw
    case 'Number':
    case 'Decimal128': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new Error(`${name} must be a number`)
      if (field.integer && !Number.isInteger(raw)) throw new Error(`${name} must be a whole number`)
      if (field.type === 'Decimal128' && Math.round(raw * 100) / 100 !== raw) {
        throw new Error(`${name} may have at most 2 decimal places`)
      }
      if (field.minValue !== undefined && raw < field.minValue) {
        throw new Error(`${name} must be at least ${field.minValue}`)
      }
      if (field.maxValue !== undefined && raw > field.maxValue) {
        throw new Error(`${name} must be at most ${field.maxValue}`)
      }
      return raw
    }
    default:
      throw new Error(`Unsupported field type for ${name}`)
  }
}

/**
 * Validates, type-checks and sanitizes one section of the request body.
 * Unknown keys are rejected so only schema fields can ever reach the database.
 */
export function validateSection(input, spec, label) {
  const errors = {}
  const output = {}

  if (!isPlainObject(input)) {
    return { errors: { [label]: `${label} details are required` }, output }
  }

  for (const key of Object.keys(input)) {
    if (OBJECT_KEYS_DENIED.test(key) || !(key in spec)) {
      errors[`${label}.${key}`] = 'Unexpected field'
    }
  }

  for (const [key, field] of Object.entries(spec)) {
    const raw = input[key]
    const empty = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')
    const required = typeof field.required === 'function' ? field.required(input) : field.required
    if (empty) {
      if (required) errors[`${label}.${key}`] = `${field.label ?? key} is required`
      continue
    }
    try {
      output[key] = coerce(field.label ?? key, field, raw)
    } catch (error) {
      errors[`${label}.${key}`] = error.message
    }
  }

  return { errors, output }
}

export { EMAIL, fieldFromSchema }
