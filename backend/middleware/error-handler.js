export function errorHandler(error, _request, response, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500

  if (status >= 500) {
    console.error(error)
  }

  response.status(status).json({
    error: status >= 500 ? 'Internal server error.' : error.message,
  })
}
