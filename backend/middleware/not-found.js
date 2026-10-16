export function notFound(request, _response, next) {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`)
  error.status = 404
  next(error)
}
