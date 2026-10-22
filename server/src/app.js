import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { blockReadOnlyWrites, requireAuth } from './middleware/auth.js';
import { asyncH, errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import dashboardRoutes from './routes/dashboard.js';
import documentRoutes from './routes/documents.js';
import rcRoutes from './routes/rc.js';
import reminderRoutes from './routes/reminders.js';
import searchRoutes from './routes/search.js';
import templateRoutes from './routes/templates.js';
import tenantRoutes from './routes/tenant.js';
import userRoutes from './routes/users.js';
import vehicleRoutes from './routes/vehicles.js';
import walletRoutes, { razorpayWebhook } from './routes/wallet.js';
import pipelineRoutes from './routes/pipeline.js';
import reportRoutes from './routes/reports.js';
import dataRoutes from './routes/data.js';
import pucRoutes from './routes/puc.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  app.use(compression());
  app.post('/api/wallet/webhook', express.raw({ type: 'application/json' }), asyncH(razorpayWebhook));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);

  const authed = express.Router();
  authed.use(requireAuth, blockReadOnlyWrites);
  authed.use('/customers', customerRoutes);
  authed.use('/vehicles', vehicleRoutes);
  authed.use('/documents', documentRoutes);
  authed.use('/rc', rcRoutes);
  authed.use('/dashboard', dashboardRoutes);
  authed.use('/reminders', reminderRoutes);
  authed.use('/templates', templateRoutes);
  authed.use('/search', searchRoutes);
  authed.use('/tenant', tenantRoutes);
  authed.use('/users', userRoutes);
  authed.use('/wallet', walletRoutes);
  authed.use('/pipeline', pipelineRoutes);
  authed.use('/reports', reportRoutes);
  authed.use('/data', dataRoutes);
  authed.use('/puc', pucRoutes);
  app.use('/api', authed);

  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
  app.use(errorHandler);
  return app;
}
