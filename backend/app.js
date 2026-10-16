import express from 'express'
import { errorHandler } from './middleware/error-handler.js'
import { notFound } from './middleware/not-found.js'
import apiRouter from './routes/index.js'

const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use('/api', apiRouter)
app.use(notFound)
app.use(errorHandler)

export default app
