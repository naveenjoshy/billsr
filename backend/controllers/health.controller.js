import mongoose from 'mongoose'
import { HTTP_STATUS } from '../constants/httpConstants.js'

export function getHealth(_request, response) {
  const databaseReady = mongoose.connection.readyState === 1

  response.status(databaseReady ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
    status: databaseReady ? 'ok' : 'unavailable',
    database: databaseReady ? 'connected' : 'disconnected',
    uptimeSeconds: Math.floor(process.uptime()),
  })
}
