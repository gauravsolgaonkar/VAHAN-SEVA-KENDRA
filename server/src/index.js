import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';
import { buildAllQueues, startReminderCron } from './jobs/reminders.js';
import { activeProviders } from './rc/index.js';

await mongoose.connect(config.mongoUri);
console.log('[db] connected');

const app = createApp();
app.listen(config.port, () => {
  console.log(`[api] listening on :${config.port}`);
  console.log(`[rc] providers: ${activeProviders().map((p) => p.name).join(' -> ') || 'none configured'}`);
});

startReminderCron();
// Catch up on boot in case the server was asleep at 8 AM (Render free tier sleeps).
buildAllQueues().catch((e) => console.error('[reminders] boot run failed', e));
