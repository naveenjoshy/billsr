import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import connectDB from './config/db.js';

// 1. Initialize environmental configurations
dotenv.config();

// 2. Establish connection to your MongoDB Cluster
connectDB();

const app = express();

// ==========================================
// MIDDLEWARE CONFIGURATIONS
// ==========================================

// Enable Cross-Origin Resource Sharing for your Vite React frontend
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// HTTP Request logging logger for development transparency
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  app.use(morgan('dev'));
}

// Built-in Request Body Parsers (Transforms inbound JSON stream payloads)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// ROUTE REGISTRATION POINT
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date() 
  });
});

// App Router Placeholders (Uncomment once routes are initialized)
// import authRoutes from './routes/auth.js';
// app.use('/api/auth', authRoutes);

// ==========================================
// CATCH-ALL ERROR HANDLING ENGINE
// ==========================================

// 404 Route handler for unrecognized paths
app.use((req, res, next) => {
  const error = new Error(`Resource Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// Global Fallback execution crash barrier
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// ==========================================
// ENGINE SPIN-UP & GRACEFUL SHUTDOWN
// ==========================================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`System server runtime initialized on port ${PORT}`);
});

// Handle graceful termination process signals
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server and database connections');
  server.close(async () => {
    await mongoose.connection.close();
    console.log('HTTP server and database connections successfully closed');
    process.exit(0);
  });
});
