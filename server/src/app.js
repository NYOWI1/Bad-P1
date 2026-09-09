import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { api } from './routes/api.js';
import { errorHandler } from './middleware/errorHandler.js';
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  })
);
app.use(express.json({ limit: '64kb' }));
app.use('/project/api', api);
app.use('/api', api);
app.use((req, res) =>
  res.status(404).json({ error: { message: 'Endpoint not found.' } })
);
app.use(errorHandler);
