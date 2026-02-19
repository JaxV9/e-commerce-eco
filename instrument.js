import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

dotenv.config();

Sentry.init({
  dsn: process.env.SENTRY_DSN_BACKEND,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  integrations: [
    nodeProfilingIntegration(),
  ],

  // (optionnel)
  enableLogs: true,

  // Tracing / profiling (à ajuster, 1.0 = 100% => lourd en prod)
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.2),
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.0),

  // ⚠️ évite ça en prod si tu ne veux pas envoyer des données sensibles
  sendDefaultPii: false,
});
