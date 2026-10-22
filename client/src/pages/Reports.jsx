import { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadFile } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, ErrorBox, ExpiryPill, Loading, Plate } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { displayRegNo, fmtDate } from '../util.js';
import { CaseChip } from './Pipeline.jsx';

const inr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const GROUPS = ['month', 'agent', 'insurer', 'vehicleType', 'platform'];
const today = () => new Date().toISOString().slice(0, 10);

function ExportBtn({ path, name }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  return (
    <>
      <button type="button" className="btn block" disabled={busy} onClick={async () => {
        setBusy(true);
        setErr(null);
        try { await downloadFile(path, name); } catch (e) { setErr(e); } finally { setBusy(false); }
      }}>
        {busy ? <span className="spinner dark" /> : <><Icon name="download" /> {t('exportExcel')}</>}
      </button>
      {err && <div className="banner err">{errorText(t, err)}</div>}
    </>
  );
}

function monthLabel(key, lang) {
  if (!/^\d{4}-\d{2}$/.test(key)) return key;
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { month: 'short', year: '2-digit' });
}

function Business() {
  const { t, lang } = useI18n();
  const [groupBy, setGroupBy] = useState('month');
  const { data, loading, error, reload } = useApi(`/reports/business?groupBy=${groupBy}`, [groupBy]);
  const label = (k) => (groupBy === 'month' ? monthLabel(k, lang) : groupBy === 'vehicleType' ? t(`vt_${k}`) === `vt_${k}` ? k : t(`vt_${k}`) : k);
  return (
    <div className="stack">
      {data && (
        <div className="grid2">
          <div className="card stat"><div className="k">{data.totals.policies}</div><div className="l">{t('policies')}</div></div>
          <div className="card stat"><div className="k">{inr(data.totals.premium)}</div><div className="l">{t('premium')}</div></div>
          <div className="card stat"><div className="k" style={{ color: 'var(--green)' }}>{inr(data.totals.commission)}</div><div className="l">{t('commission')}</div></div>
          <div className="card stat"><div className="k" style={{ color: 'var(--amber)' }}>{inr(data.totals.pending)}</div><div className="l">{t('pendingPayout')}</div></div>
        </div>
      )}
      <div className="row small bold muted">{t('groupBy')}</div>
      <div className="chips">
        {GROUPS.map((g) => <button key={g} type="button" className={`chip ${groupBy === g ? 'on' : ''}`} onClick={() => setGroupBy(g)}>{t(`g_${g}`)}</button>)}
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <div className="card flush table-wrap">
          <table className="data-table">
            <thead><tr><th>{t(`g_${groupBy}`)}</th><th>{t('policies')}</th><th>{t('premium')}</th><th>{t('commission')}</th><th>{t('pendingPayout')}</th></tr></thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={5} className="muted">{t('noCases')}</td></tr>}
              {data.rows.map((r) => (
                <tr key={r.key}>
                  <td>{label(r.key)}</td><td>{r.policies}</td><td>{inr(r.premium)}</td>
                  <td style={{ color: 'var(--green)' }}>{inr(r.commission)}</td><td style={{ color: r.pending ? 'var(--amber)' : undefined }}>{inr(r.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ExportBtn path="/reports/export/business.xlsx" name={`business-${today()}.xlsx`} />
    </div>
  );
}

function Expiring() {
  const { t } = useI18n();
  const [win, setWin] = useState('week');
  const { data, loading, error, reload } = useApi(`/reports/expiring?window=${win}`, [win]);
  return (
    <div className="stack">
      <div className="seg">
        {['today', 'week', 'month'].map((w) => <button key={w} type="button" className={win === w ? 'on' : ''} onClick={() => setWin(w)}>{t(`w_${w}`)}</button>)}
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <div className="card flush">
          <div className="list">
            {data.length === 0 && <div className="empty small">{t('noCases')}</div>}
            {data.map((d) => (
              <Link key={d.id} className="list-item" to={d.vehicleId ? `/vehicles/${d.vehicleId}` : `/customers/${d.customerId}`}>
                <div className="main">
                  <div className="t">{d.customer}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                    {d.regNo && <Plate regNo={d.regNo} />}
                    <span className="small bold">{t(`doc_${d.type}`)}</span>
                    <CaseChip status={d.caseStatus} />
                  </div>
                </div>
                <ExpiryPill date={d.expiryDate} />
              </Link>
            ))}
          </div>
        </div>
      )}
      <ExportBtn path={`/reports/export/expiring.xlsx?window=${win}`} name={`expiring-${win}-${today()}.xlsx`} />
    </div>
  );
}

function DataTools() {
  const { t } = useI18n();
  return (
    <div className="stack">
      <Link to="/import" className="card add-option">
        <span className="ic b"><Icon name="upload" size={26} /></span>
        <span className="spacer bold">{t('importData')}</span>
        <Icon name="chevron" />
      </Link>
      <ExportAll />
    </div>
  );
}

function ExportAll() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="card add-option" style={{ border: 0, textAlign: 'left', width: '100%' }} disabled={busy}
      onClick={async () => { setBusy(true); try { await downloadFile('/data/export/all.xlsx', `vahan-seva-kendra-${today()}.xlsx`); } finally { setBusy(false); } }}>
      <span className="ic o">{busy ? <span className="spinner dark" /> : <Icon name="download" size={26} />}</span>
      <span className="spacer bold">{t('exportAll')}</span>
    </button>
  );
}

const time = (d) => `${fmtDate(d)} ${new Date(d).toTimeString().slice(0, 5)}`;

function RcLog() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useApi('/rc/logs');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const s = data.summary;
  return (
    <div className="stack">
      <div className="grid3">
        <div className="card center"><div className="bold" style={{ fontSize: '1.4rem' }}>{s.live}</div><div className="tiny muted">{t('live')}</div></div>
        <div className="card center"><div className="bold" style={{ fontSize: '1.4rem' }}>{s.cached}</div><div className="tiny muted">{t('cached')}</div></div>
        <div className="card center"><div className="bold" style={{ fontSize: '1.4rem', color: s.failed ? 'var(--red)' : undefined }}>{s.failed}</div><div className="tiny muted">{t('failed')}</div></div>
      </div>
      <div className="card flush">
        <div className="list">
          {data.logs.map((l) => (
            <div className="list-item" key={l._id}>
              <div className="main">
                <div className="t mono">{displayRegNo(l.regNo)}</div>
                <div className="s">{time(l.createdAt)} · {t('by')} {l.userId?.name} · {l.provider}{l.durationMs ? ` · ${l.durationMs} ms` : ''}</div>
                {l.error && <div className="tiny" style={{ color: 'var(--red)' }}>{l.error}</div>}
              </div>
              <span className={`pill ${l.cached ? 'blue' : l.success ? 'active' : 'expired'}`}>{l.cached ? t('cached') : l.success ? t('live') : t('failed')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConsentLog() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useApi('/rc/consents');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <div className="card flush">
      <div className="list">
        {data.map((c) => (
          <div className="list-item" key={c._id}>
            <div className="main">
              <div className="t mono">{displayRegNo(c.regNo)}</div>
              <div className="s">{time(c.createdAt)} · {t('by')} {c.userId?.name}</div>
              <div className="tiny muted">“{c.text}”</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Reports() {
  const { t } = useI18n();
  const { isOwner } = useAuth();
  const [tab, setTab] = useState('business');
  const tabs = ['business', 'expiring', 'data', ...(isOwner ? ['rc', 'consent'] : [])];
  const label = { business: t('business'), expiring: t('expiring'), data: t('data'), rc: t('rcLog'), consent: t('consentLog') };
  return (
    <div className="stack">
      <h2 style={{ fontSize: '1.2rem' }}>{t('reports')}</h2>
      <div className="chips">
        {tabs.map((k) => <button key={k} type="button" className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label[k]}</button>)}
      </div>
      {tab === 'business' && <Business />}
      {tab === 'expiring' && <Expiring />}
      {tab === 'data' && <DataTools />}
      {tab === 'rc' && <RcLog />}
      {tab === 'consent' && <ConsentLog />}
    </div>
  );
}
