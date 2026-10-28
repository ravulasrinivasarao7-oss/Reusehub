import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import materialsRoutes from './routes/materials.routes.js';
import { originCheck } from './middleware/originCheck.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandlers.js';

const app = express();

// credentials: true lets the browser send the session cookie to the API.
app.use(cors({ origin: env.frontendOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(originCheck);

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/materials', materialsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
