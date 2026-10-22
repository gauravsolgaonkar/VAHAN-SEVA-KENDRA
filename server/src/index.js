import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';
import { resumeBulkJobs } from './jobs/bulk.js';
import { buildAllQueues, startReminderCron } from './jobs/reminders.js';
import User from './models/User.js';
import { activeProviders } from './rc/index.js';
import { OWNER_MOBILE, seedDemo } from './seedDemo.js';

await mongoose.connect(config.mongoUri);
console.log('[db] connected');

// Live preview: create the demo tenant once if asked to.
if (process.env.SEED_DEMO === '1' && !(await User.exists({ mobile: OWNER_MOBILE }))) await seedDemo();

const app = createApp();
app.listen(config.port, () => {
  console.log(`[api] listening on :${config.port}`);
  console.log(`[rc] providers: ${activeProviders().map((p) => p.name).join(' -> ') || 'none configured'}`);
});

startReminderCron();
resumeBulkJobs().catch((e) => console.error('[bulk] resume failed', e));
// Catch up on boot in case the server was asleep at 8 AM (Render free tier sleeps).
buildAllQueues().catch((e) => console.error('[reminders] boot run failed', e));
