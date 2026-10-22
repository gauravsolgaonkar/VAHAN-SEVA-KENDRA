import { config } from '../config.js';
import BulkJob from '../models/BulkJob.js';
import Customer from '../models/Customer.js';
import RcRecord from '../models/RcRecord.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { buildQueueForTenant } from './reminders.js';
import { lookupRc } from '../rc/index.js';
import { normalizeRegNo } from '../utils/regno.js';
import { upsertVehicleFromRc } from '../utils/vehicleFromRc.js';

const running = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Validate, de-duplicate and price a list of reg nos before starting. */
export async function estimateBulk(tenantId, input) {
  const seen = new Set();
  const valid = [];
  const invalid = [];
  let duplicates = 0;
  for (const raw of input) {
    if (!String(raw).trim()) continue;
    const n = normalizeRegNo(raw);
    if (!n.ok) invalid.push(String(raw).trim());
    else if (seen.has(n.regNo)) duplicates += 1;
    else {
      seen.add(n.regNo);
      valid.push(n.regNo);
    }
  }
  const cutoff = new Date(Date.now() - config.rcCacheDays * 86400000);
  const [cached, existing, tenant] = await Promise.all([
    RcRecord.find({ tenantId, regNo: { $in: valid }, fetchedAt: { $gte: cutoff } }).select('regNo').lean(),
    Vehicle.find({ tenantId, regNo: { $in: valid } }).select('regNo').lean(),
    Tenant.findById(tenantId).select('rcCredits').lean(),
  ]);
  const cachedSet = new Set(cached.map((x) => x.regNo));
  return {
    valid, invalid, duplicates,
    cached: valid.filter((r) => cachedSet.has(r)),
    existing: existing.map((x) => x.regNo),
    creditsNeeded: valid.filter((r) => !cachedSet.has(r)).length,
    balance: tenant?.rcCredits ?? 0,
  };
}

async function processItem(job, item, user) {
  const { record, cached } = await lookupRc({ tenantId: job.tenantId, user, regNo: item.regNo, ip: `bulk:${job._id}`, userAgent: 'bulk' });
  const customer = job.customerId ? await Customer.findOne({ _id: job.customerId, tenantId: job.tenantId }) : null;
  const { vehicle } = await upsertVehicleFromRc({ tenantId: job.tenantId, agentId: user._id, record, customer });
  item.status = 'done';
  item.cached = cached;
  item.vehicleId = vehicle._id;
  item.ownerName = vehicle.ownerName;
}

/** Works through a job's queue one fetch at a time. Safe to call again for a job that is already running. */
export async function runBulkJob(jobId) {
  const key = String(jobId);
  if (running.has(key)) return;
  running.add(key);
  try {
    const job = await BulkJob.findById(jobId);
    const user = job && await User.findById(job.userId);
    if (!job || !user) return;
    for (const item of job.items) {
      if (item.status !== 'queued') continue;
      const fresh = await BulkJob.findById(jobId).select('status').lean();
      if (fresh?.status === 'stopped') break;
      try {
        await processItem(job, item, user);
      } catch (e) {
        item.status = 'failed';
        item.error = e.code || e.message;
        if (e.code === 'no_credits') {
          for (const rest of job.items) if (rest.status === 'queued') Object.assign(rest, { status: 'failed', error: 'no_credits' });
        }
      }
      await BulkJob.updateOne({ _id: job._id }, { $set: { items: job.items } });
      if (!item.cached) await sleep(config.bulkDelayMs);
    }
    const final = await BulkJob.findById(jobId).select('status').lean();
    await BulkJob.updateOne({ _id: job._id }, { $set: { status: final.status === 'stopped' ? 'stopped' : 'done', finishedAt: new Date() } });
    const tenant = await Tenant.findById(job.tenantId);
    if (tenant) await buildQueueForTenant(tenant);
  } finally {
    running.delete(key);
  }
}

/** Resume jobs interrupted by a restart (Render free instances sleep). */
export async function resumeBulkJobs() {
  const jobs = await BulkJob.find({ status: 'running' }).select('_id').lean();
  for (const j of jobs) runBulkJob(j._id).catch((e) => console.error('[bulk]', e));
}
