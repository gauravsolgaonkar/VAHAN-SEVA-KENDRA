import cron from 'node-cron';
import { config } from '../config.js';
import Document from '../models/Document.js';
import Reminder from '../models/Reminder.js';
import Tenant, { DEFAULT_REMINDER_OFFSETS } from '../models/Tenant.js';
import { addDays, daysUntil, istDayStart } from '../utils/dates.js';
import { ensureCase } from '../utils/renewal.js';
import { runAllRenewalChecks } from './renewalCheck.js';

// Expired documents older than this stop generating reminders.
const MAX_DAYS_PAST = 30;

function offsetsFor(tenant, docType) {
  const map = tenant.settings?.reminderOffsets;
  const get = (k) => (map instanceof Map ? map.get(k) : map?.[k]);
  const list = get(docType) || get('default') || DEFAULT_REMINDER_OFFSETS;
  return [...list].sort((a, b) => a - b);
}

/**
 * The reminder step a document is currently in: the smallest configured offset that is
 * >= days left. e.g. offsets [30,15,7,3,1,-1] and 5 days left -> 7. Picking the step
 * (rather than requiring an exact day match) means a missed cron run or a document added
 * mid-window still gets queued.
 */
export function currentStep(offsets, days) {
  if (days === null) return null;
  const step = offsets.find((o) => o >= days);
  return step === undefined ? null : step;
}

export async function buildQueueForTenant(tenant, now = new Date()) {
  const today = istDayStart(now);
  const configured = [...(tenant.settings?.reminderOffsets?.values?.() || [])].flat();
  const maxAhead = Math.max(...configured, ...DEFAULT_REMINDER_OFFSETS);
  const docs = await Document.find({
    tenantId: tenant._id,
    status: 'active',
    expiryDate: { $gte: addDays(today, -MAX_DAYS_PAST), $lte: addDays(today, maxAhead + 1) },
  }).select('_id tenantId agentId customerId vehicleId type expiryDate');

  let created = 0;
  for (const doc of docs) {
    const step = currentStep(offsetsFor(tenant, doc.type), daysUntil(doc.expiryDate, now));
    if (step === null) continue;
    await ensureCase(doc);
    const key = { documentId: doc._id, offsetDays: step, expiryDate: doc.expiryDate };
    const exists = await Reminder.findOne(key).select('_id');
    if (exists) continue;
    // A newer step supersedes any older reminder for the same document still waiting.
    await Reminder.updateMany({ documentId: doc._id, status: 'pending' }, { $set: { status: 'skipped' } });
    await Reminder.create({
      ...key,
      tenantId: tenant._id,
      agentId: doc.agentId,
      customerId: doc.customerId,
      vehicleId: doc.vehicleId,
      docType: doc.type,
      scheduledFor: today,
    });
    created += 1;
  }
  return created;
}

export async function buildAllQueues(now = new Date()) {
  const tenants = await Tenant.find({});
  let total = 0;
  for (const t of tenants) total += await buildQueueForTenant(t, now);
  return total;
}

export function startReminderCron() {
  if (config.disableCron) return;
  cron.schedule(
    config.reminderCron,
    async () => {
      try {
        console.log(`[reminders] queued ${await buildAllQueues()}`);
        await runAllRenewalChecks();
      } catch (e) {
        console.error('[reminders]', e);
      }
    },
    { timezone: 'Asia/Kolkata' },
  );
}
