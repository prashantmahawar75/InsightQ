import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { queryRouter } from './routes/query.js';
import { uploadRouter } from './routes/upload.js';
import { initializeDatabase } from './data/seedData.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '15mb' }));

// Routes
app.use('/api/query', queryRouter);
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize demo database and start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`InsightQ backend running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

export default app;
