import 'dotenv/config';

const env = process.env;

export const config = {
  port: Number(env.PORT || 4000),
  mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vsk',
  jwtSecret: env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '30d',
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  uploadDir: env.UPLOAD_DIR || 'uploads',
  // RC providers in priority order. First is primary, the rest are fallbacks.
  rcProviders: (env.RC_PROVIDERS || 'mock').split(',').map((s) => s.trim()).filter(Boolean),
  rcTimeoutMs: Number(env.RC_TIMEOUT_MS || 12000),
  rcCacheDays: Number(env.RC_CACHE_DAYS || 30),
  rcRateLimitPerMinute: Number(env.RC_RATE_LIMIT_PER_MINUTE || 10),
  rcDailyLimitPerUser: Number(env.RC_DAILY_LIMIT_PER_USER || 200),
  surepass: { baseUrl: env.SUREPASS_BASE_URL || 'https://kyc-api.surepass.io', token: env.SUREPASS_TOKEN || '' },
  cashfree: { baseUrl: env.CASHFREE_BASE_URL || 'https://api.cashfree.com', clientId: env.CASHFREE_CLIENT_ID || '', clientSecret: env.CASHFREE_CLIENT_SECRET || '' },
  reminderCron: env.REMINDER_CRON || '0 8 * * *',
  disableCron: env.DISABLE_CRON === '1',
};
