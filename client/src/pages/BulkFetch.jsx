import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, PageHeader } from '../components/ui.jsx';
import { useApi, useDebounced } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { cleanRegNo, displayRegNo, fmtDate, validateRegNo } from '../util.js';

/** Pull anything that looks like a reg no. out of spreadsheet cells. */
function regNosFromRows(rows) {
  const out = [];
  for (const row of rows) for (const cell of row) {
    const v = String(cell ?? '');
    if (v.length >= 6 && v.length <= 16 && validateRegNo(v).ok && /\d{4}/.test(cleanRegNo(v))) out.push(v.trim());
  }
  return out;
}

function CustomerPicker({ value, onChange }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data } = useApi(dq.length >= 2 && !value ? `/customers?q=${encodeURIComponent(dq)}&limit=8` : null, [dq]);
  if (value) {
    return (
      <div className="card row" style={{ padding: 10 }}>
        <Icon name="user" /><span className="spacer bold">{value.name}</span>
        <button type="button" className="icon-btn" onClick={() => onChange(null)} aria-label="clear"><Icon name="x" /></button>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <input className="input" placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
      {dq.length >= 2 && data?.map((c) => (
        <button type="button" key={c._id} className="btn block" style={{ justifyContent: 'flex-start' }} onClick={() => onChange(c)}>
          {c.name} <span className="muted small">{c.mobile}</span>
        </button>
      ))}
    </div>
  );
}

function JobView({ id, onNew }) {
  const { t } = useI18n();
  const { tenant, setTenant } = useAuth();
  const { data: job, reload, error } = useApi(`/rc/bulk/${id}`, [id]);
  const running = job?.status === 'running';

  useEffect(() => {
    if (!running) return undefined;
    const tm = setInterval(reload, 1500);
    return () => clearInterval(tm);
  }, [running, reload]);

  // Refresh the credit balance shown elsewhere once the job ends.
  useEffect(() => {
    if (job && !running) api('/wallet').then((w) => setTenant({ ...tenant, rcCredits: w.balance })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  if (error) return <div className="banner err">{errorText(t, error)}</div>;
  if (!job) return <div className="empty"><span className="spinner dark" /></div>;
  const n = job.items.length;
  const doneN = job.items.filter((i) => i.status === 'done').length;
  const failed = job.items.filter((i) => i.status === 'failed').length;
  const processed = n - job.items.filter((i) => i.status === 'queued').length;
  const noCredits = job.items.some((i) => i.error === 'no_credits');
  return (
    <div className="stack">
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row">
          <span className="spacer bold">{running ? t('running') : t(`status_${job.status}`)}</span>
          <span className="bold mono">{processed} / {n}</span>
        </div>
        <div className="progress"><div style={{ width: `${n ? (processed / n) * 100 : 0}%` }} /></div>
        <div className="row small">
          <span className="pill active">{t('done')}: {doneN}</span>
          {failed > 0 && <span className="pill expired">{t('failedN', { n: failed })}</span>}
          <span className="spacer" />
          {running && <button type="button" className="btn sm danger" onClick={() => api(`/rc/bulk/${id}/stop`, { method: 'POST' }).then(reload)}>{t('stop')}</button>}
        </div>
        {noCredits && <div className="banner err row"><span className="spacer">{t('noCredits')}</span><Link className="btn sm primary" to="/wallet">{t('buyCredits')}</Link></div>}
      </div>
      <div className="card flush">
        <div className="list">
          {job.items.map((i) => (
            <div className="list-item" key={i.regNo}>
              <div className="main">
                <div className="t mono">{displayRegNo(i.regNo)}</div>
                {i.ownerName && <div className="s">{i.ownerName}</div>}
                {i.error && <div className="tiny" style={{ color: 'var(--red)' }}>{i.error === 'no_credits' ? t('noCredits') : i.error === 'not_found' ? t('rcNotFound') : t('rcFailed')}</div>}
              </div>
              {i.vehicleId ? (
                <Link to={`/vehicles/${i.vehicleId}`} className={`pill ${i.cached ? 'blue' : 'active'}`}>{i.cached ? t('cached') : t('status_done')} →</Link>
              ) : (
                <span className={`pill ${i.status === 'failed' ? 'expired' : 'none'}`}>{i.status === 'queued' && running ? <span className="spinner dark" style={{ width: 12, height: 12 }} /> : t(`status_${i.status}`)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      {!running && <button type="button" className="btn block" onClick={onNew}>{t('bulkFetch')}</button>}
    </div>
  );
}

export default function BulkFetch() {
  const { t } = useI18n();
  const { canWrite } = useAuth();
  const [params, setParams] = useSearchParams();
  const jobId = params.get('job');
  const [text, setText] = useState('');
  const [est, setEst] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [assign, setAssign] = useState('owner');
  const [customer, setCustomer] = useState(null);
  const [includeExisting, setIncludeExisting] = useState(false);
  const [consent, setConsent] = useState(false);
  const jobs = useApi(jobId ? null : '/rc/bulk', [jobId]);

  if (jobId) return (<div className="stack"><PageHeader title={t('bulkFetch')} /><JobView id={jobId} onNew={() => setParams({})} /></div>);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr(null);
    try {
      let list;
      if (/\.xlsx$/i.test(f.name)) {
        const form = new FormData();
        form.append('file', f);
        const parsed = await api('/data/import/parse', { method: 'POST', form });
        list = regNosFromRows([parsed.headers, ...parsed.rows]);
      } else {
        list = (await f.text()).split(/[\r\n,;\t]+/).map((s) => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
      }
      setText((cur) => [cur.trim(), ...list].filter(Boolean).join('\n'));
      setEst(null);
    } catch (ex) {
      setErr(ex);
    }
  };

  const check = async () => {
    setBusy(true);
    setErr(null);
    try {
      setEst(await api('/rc/bulk/estimate', { method: 'POST', body: { text } }));
    } catch (ex) {
      setErr(ex);
    } finally {
      setBusy(false);
    }
  };

  const toFetch = est ? est.valid.filter((r) => includeExisting || !est.existing.includes(r)) : [];
  const cost = est ? toFetch.filter((r) => !est.cached.includes(r)).length : 0;
  const short = est && cost > est.balance;

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const job = await api('/rc/bulk', {
        method: 'POST',
        body: { text, consent, includeExisting, customerId: assign === 'one' ? customer?._id : undefined },
      });
      setParams({ job: job._id });
    } catch (ex) {
      setErr(ex);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <PageHeader title={t('bulkFetch')} right={<Link to="/wallet" className="pill blue"><Icon name="wallet" size={14} /> {t('wallet')}</Link>} />
      <div className="card stack" style={{ gap: 10 }}>
        <div className="small muted">{t('bulkHint')}</div>
        <textarea
          className="input mono" rows={7} value={text} placeholder={'MH08AB1234\nMH09CD5678\nMH 12 EF 9012'}
          onChange={(e) => { setText(e.target.value); setEst(null); }}
          style={{ resize: 'vertical', minHeight: 140 }}
        />
        <label className="btn block">
          <Icon name="upload" /> {t('uploadList')}
          <input type="file" accept=".txt,.csv,.xlsx" hidden onChange={onFile} />
        </label>
        {!est && <button type="button" className="btn primary lg block" disabled={!text.trim() || busy} onClick={check}>{busy ? <span className="spinner" /> : t('checkList')}</button>}
      </div>

      {est && (
        <div className="card stack" style={{ gap: 12 }}>
          <div className="grid3">
            <div className="stat center"><div className="k" style={{ color: 'var(--green)' }}>{est.valid.length}</div><div className="l">{t('valid')}</div></div>
            <div className="stat center"><div className="k" style={{ color: est.invalid.length ? 'var(--red)' : undefined }}>{est.invalid.length}</div><div className="l">{t('invalid')}</div></div>
            <div className="stat center"><div className="k">{est.duplicates}</div><div className="l">{t('duplicates')}</div></div>
          </div>
          {est.invalid.length > 0 && <div className="tiny" style={{ color: 'var(--red)' }}>{est.invalid.slice(0, 10).join(', ')}{est.invalid.length > 10 ? '…' : ''}</div>}
          <div className="kv"><span className="k">{t('fromSaved')}</span><span className="v">{toFetch.filter((r) => est.cached.includes(r)).length}</span></div>
          {est.existing.length > 0 && (
            <>
              <div className="kv"><span className="k">{t('alreadyAdded2')}</span><span className="v">{est.existing.length}</span></div>
              <label className={`check ${includeExisting ? 'on' : ''}`}>
                <input type="checkbox" checked={includeExisting} onChange={(e) => setIncludeExisting(e.target.checked)} />
                <span className="small">{t('includeExisting')}</span>
              </label>
            </>
          )}
          <div className="row" style={{ background: 'var(--blue-soft)', borderRadius: 12, padding: 12 }}>
            <span className="spacer bold">{t('creditsNeeded')}</span>
            <span className="bold" style={{ fontSize: '1.4rem' }}>{cost}</span>
            <span className="small muted">/ {est.balance}</span>
          </div>
          {short && <div className="banner err row"><span className="spacer">{t('notEnoughCredits', { n: cost, b: est.balance })}</span><Link className="btn sm primary" to="/wallet">{t('buyCredits')}</Link></div>}

          <div className="field">
            <label>{t('assignTo')}</label>
            <div className="seg">
              <button type="button" className={assign === 'owner' ? 'on' : ''} onClick={() => setAssign('owner')}>{t('ownerPerVehicle')}</button>
              <button type="button" className={assign === 'one' ? 'on' : ''} onClick={() => setAssign('one')}>{t('oneCustomer')}</button>
            </div>
          </div>
          {assign === 'one' && <CustomerPicker value={customer} onChange={setCustomer} />}

          <label className={`check ${consent ? 'on' : ''}`}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="small">{t('consent')}</span>
          </label>
          <button
            type="button" className="btn primary lg block"
            disabled={!canWrite || busy || !consent || !toFetch.length || short || (assign === 'one' && !customer)}
            onClick={start}
          >
            {busy ? <span className="spinner" /> : t('startFetch', { n: toFetch.length })}
          </button>
        </div>
      )}
      {err && <div className="banner err">{errorText(t, err)}</div>}

      {jobs.data?.length > 0 && (
        <>
          <div className="section-title"><h2>{t('recentJobs')}</h2></div>
          <div className="card flush">
            <div className="list">
              {jobs.data.map((j) => {
                const d = j.items.filter((i) => i.status === 'done').length;
                const f = j.items.filter((i) => i.status === 'failed').length;
                return (
                  <Link className="list-item" key={j._id} to={`/bulk?job=${j._id}`}>
                    <div className="main">
                      <div className="t">{j.items.length} · {j.source === 'import' ? t('import') : t('bulkFetch')}</div>
                      <div className="s">{fmtDate(j.createdAt)} · {t('done')} {d}{f ? ` · ${t('failedN', { n: f })}` : ''}</div>
                    </div>
                    <span className={`pill ${j.status === 'running' ? 'due15' : j.status === 'done' ? 'active' : 'none'}`}>{t(`status_${j.status}`)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
