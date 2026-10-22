import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, PageHeader } from '../components/ui.jsx';
import { useI18n } from '../i18n.jsx';

export default function Import() {
  const { t } = useI18n();
  const { tenant, canWrite } = useAuth();
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [autoFetch, setAutoFetch] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', f);
      const p = await api('/data/import/parse', { method: 'POST', form });
      setParsed({ ...p, name: f.name });
      setMapping(p.mapping);
    } catch (ex) {
      setErr(ex);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    setErr(null);
    try {
      setResult(await api('/data/import/commit', { method: 'POST', body: { rows: parsed.rows, mapping, autoFetch, consent } }));
      setParsed(null);
    } catch (ex) {
      setErr(ex);
    } finally {
      setBusy(false);
    }
  };

  const regCol = mapping.regNo;
  const regCount = parsed && regCol !== undefined && regCol !== null && regCol !== ''
    ? new Set(parsed.rows.map((r) => String(r[Number(regCol)] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean)).size : 0;
  const canCommit = parsed && (mapping.customerName !== undefined || mapping.regNo !== undefined) && (!autoFetch || consent);

  return (
    <div className="stack">
      <PageHeader title={t('importData')} />
      {!parsed && (
        <label className="card add-option" style={{ cursor: 'pointer' }}>
          <span className="ic b">{busy ? <span className="spinner dark" /> : <Icon name="upload" size={26} />}</span>
          <span className="spacer">
            <div className="bold">{t('chooseFile')}</div>
            <div className="small muted">.xlsx / .csv</div>
          </span>
          <input type="file" accept=".xlsx,.csv" hidden onChange={onFile} disabled={!canWrite} />
        </label>
      )}

      {result && (
        <div className="card stack" style={{ gap: 10 }}>
          <div className="banner ok">{t('importResult', { c: result.customers, v: result.vehicles, d: result.documents })}</div>
          {result.bulkJobId && <Link className="btn blue block" to={`/bulk?job=${result.bulkJobId}`}><Icon name="refresh" /> {t('viewBulkJob')}</Link>}
          {result.errors.length > 0 && (
            <>
              <div className="small bold">{t('rowErrors')} ({result.errors.length})</div>
              <div className="tiny" style={{ color: 'var(--red)', maxHeight: 160, overflow: 'auto' }}>
                {result.errors.map((e) => <div key={e.row}>#{e.row}: {e.error}</div>)}
              </div>
            </>
          )}
          <Link className="btn block" to="/customers">{t('customers')} →</Link>
        </div>
      )}

      {parsed && (
        <>
          <div className="card row">
            <Icon name="file" />
            <span className="spacer"><div className="bold small">{parsed.name}</div><div className="tiny muted">{t('rowsFound', { n: parsed.rows.length })}</div></span>
            <button type="button" className="icon-btn" onClick={() => setParsed(null)} aria-label="clear"><Icon name="x" /></button>
          </div>
          <div className="section-title"><h2>{t('mapColumns')}</h2></div>
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {parsed.fields.map((f) => {
              const col = mapping[f];
              const sample = col !== undefined && col !== null && col !== '' ? parsed.rows.slice(0, 3).map((r) => r[Number(col)]).filter((x) => x !== null && x !== '').join(', ') : '';
              return (
                <div className="map-row" key={f}>
                  <div>
                    <div className="small bold">{t(`f_${f}`)}</div>
                    {sample && <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40vw' }}>{sample}</div>}
                  </div>
                  <select className="input" value={col ?? ''} onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                    <option value="">{t('notMapped')}</option>
                    {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `#${i + 1}`}</option>)}
                  </select>
                </div>
              );
            })}
          </div>

          {regCount > 0 && (
            <div className="card stack" style={{ gap: 10 }}>
              <label className={`check ${autoFetch ? 'on' : ''}`}>
                <input type="checkbox" checked={autoFetch} onChange={(e) => setAutoFetch(e.target.checked)} />
                <span>
                  <div className="small bold">{t('autoFetchImported')}</div>
                  <div className="tiny muted">{t('creditsNeeded')}: ≤ {Math.min(regCount, 500)} · {t('balance')}: {tenant?.rcCredits ?? '—'}</div>
                </span>
              </label>
              {autoFetch && (
                <label className={`check ${consent ? 'on' : ''}`}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span className="small">{t('consent')}</span>
                </label>
              )}
            </div>
          )}
          <button type="button" className="btn primary lg block" disabled={!canCommit || busy} onClick={commit}>
            {busy ? <span className="spinner" /> : t('importNow', { n: parsed.rows.length })}
          </button>
        </>
      )}
      {err && <div className="banner err">{errorText(t, err)}</div>}
    </div>
  );
}
