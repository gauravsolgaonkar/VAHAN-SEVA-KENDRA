import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import CustomerFields, { emptyCustomer } from '../components/CustomerFields.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, ExpiryPill, Field, PageHeader } from '../components/ui.jsx';
import { useDebounced } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { cleanRegNo, displayRegNo, timeAgo, toInputDate, validateRegNo, VEHICLE_TYPES } from '../util.js';

const titleCase = (s = '') => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

const SECTIONS = {
  section_owner: ['ownerName', 'fatherName', 'presentAddress', 'permanentAddress'],
  section_vehicle: ['maker', 'model', 'variant', 'bodyType', 'vehicleClass', 'fuel', 'norms', 'colour', 'seatingCapacity', 'grossWeight', 'unladenWeight', 'manufacturingYear'],
  section_reg: ['registrationDate', 'rcValidUpto', 'chassisNo', 'engineNo', 'rto', 'financer', 'rcStatus'],
};
const DATE_FIELDS = new Set(['registrationDate', 'rcValidUpto']);
const NUM_FIELDS = new Set(['seatingCapacity', 'grossWeight', 'unladenWeight', 'manufacturingYear']);
const LONG_FIELDS = new Set(['presentAddress', 'permanentAddress']);

/** Same rules as the server's docsFromNormalized, for the preview list. */
function docsPreview(n) {
  if (!n) return [];
  const out = [];
  if (n.insurance?.expiry) out.push({ type: 'insurance', expiry: n.insurance.expiry, sub: [n.insurance.company, n.insurance.policyNo].filter(Boolean).join(' · ') });
  if (n.puc?.expiry) out.push({ type: 'puc', expiry: n.puc.expiry, sub: n.puc.number });
  if (n.fitnessExpiry) out.push({ type: 'fitness', expiry: n.fitnessExpiry });
  if (n.permit?.expiry) out.push({ type: 'permit', expiry: n.permit.expiry, sub: [n.permit.type, n.permit.number].filter(Boolean).join(' · ') });
  if (n.taxPaidUpto && !n.taxLifetime) out.push({ type: 'road_tax', expiry: n.taxPaidUpto });
  if (n.rcValidUpto) out.push({ type: 'rc', expiry: n.rcValidUpto });
  return out;
}

function vehicleFromRc(n) {
  const v = { vehicleType: n.vehicleType || 'car' };
  for (const keys of Object.values(SECTIONS)) for (const k of keys) v[k] = n[k] ?? '';
  for (const k of DATE_FIELDS) v[k] = toInputDate(n[k]);
  v.ownerName = titleCase(n.ownerName || '');
  v.fatherName = titleCase(n.fatherName || '');
  v.blacklisted = Boolean(n.blacklisted);
  return v;
}

function CustomerPicker({ value, onPick }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [list, setList] = useState([]);
  useEffect(() => {
    if (dq.length < 2) return setList([]);
    api(`/customers?q=${encodeURIComponent(dq)}&limit=8`).then(setList).catch(() => setList([]));
  }, [dq]);
  if (value) {
    return (
      <div className="row card" style={{ padding: 10 }}>
        <div className="avatar">{value.name[0]}</div>
        <div className="spacer"><div className="bold">{value.name}</div><div className="small muted">{value.mobile}</div></div>
        <button type="button" className="btn sm ghost" onClick={() => onPick(null)}><Icon name="x" size={18} /></button>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <input className="input" placeholder={t('pickCustomer')} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      {list.map((c) => (
        <button type="button" key={c._id} className="btn ghost block" style={{ justifyContent: 'flex-start' }} onClick={() => onPick(c)}>
          {c.name} <span className="muted small">{c.mobile}</span>
        </button>
      ))}
    </div>
  );
}

export default function AddVehicle() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [reg, setReg] = useState('');
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState('input'); // input | fetching | form
  const [rc, setRc] = useState(null);
  const [fetchErr, setFetchErr] = useState(null);
  const [v, setV] = useState({ vehicleType: 'car' });
  const [custMode, setCustMode] = useState(params.get('customerId') ? 'existing' : 'new');
  const [existing, setExisting] = useState(null);
  const [newCust, setNewCust] = useState(emptyCustomer(lang));
  const [saveErr, setSaveErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const id = params.get('customerId');
    if (id) api(`/customers/${id}`).then(setExisting).catch(() => {});
  }, [params]);

  const check = useMemo(() => validateRegNo(reg), [reg]);
  const regError = touched && reg && !check.ok ? (check.error === 'state' ? t('invalidState') : t('invalidRegNo')) : null;
  const docs = docsPreview(rc?.normalized);

  async function fetchRc() {
    setTouched(true);
    if (!check.ok) return;
    if (!consent) return setFetchErr({ code: 'consent' });
    setFetchErr(null);
    setPhase('fetching');
    try {
      const res = await api('/rc/lookup', { method: 'POST', body: { regNo: check.regNo, consent: true } });
      setRc(res);
      setV(vehicleFromRc(res.normalized));
      setNewCust((c) => ({ ...c, name: c.name || titleCase(res.normalized.ownerName || ''), city: c.city || (res.normalized.rto || '').split(',')[0] }));
      setPhase('form');
    } catch (e) {
      setFetchErr(e);
      setPhase('input');
    }
  }

  function manual() {
    setTouched(true);
    if (!check.ok) return;
    setRc(null);
    setPhase('form');
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    const body = { ...v, regNo: check.regNo, rcRecordId: rc?.rcRecordId };
    for (const k of NUM_FIELDS) body[k] = body[k] === '' ? undefined : Number(body[k]);
    for (const k of DATE_FIELDS) body[k] = body[k] || undefined;
    if (custMode === 'existing' && existing) body.customerId = existing._id;
    else body.customer = newCust;
    try {
      const res = await api('/vehicles', { method: 'POST', body });
      nav(`/vehicles/${res.vehicle._id}?created=${res.createdDocuments}`, { replace: true });
    } catch (ex) {
      setSaveErr(ex);
      setSaving(false);
    }
  }

  const fetchErrText = fetchErr && (
    fetchErr.code === 'consent' ? t('consentNeeded')
      : fetchErr.code === 'rc_not_found' ? t('rcNotFound')
        : fetchErr.code === 'rate_limited' ? t('error_rate_limited')
          : fetchErr.code?.startsWith('rc_') || fetchErr.code === 'offline' ? t('rcFailed') : errorText(t, fetchErr)
  );

  if (phase !== 'form') {
    return (
      <div className="stack">
        <PageHeader title={t('addVehicle')} />
        <div className="card stack">
          <Field label={t('regNo')} error={regError}>
            <input
              className={`input reg ${regError ? 'invalid' : ''}`} value={displayRegNo(reg)} placeholder="MH 08 AB 1234"
              onChange={(e) => setReg(cleanRegNo(e.target.value))} onBlur={() => setTouched(true)}
              autoCapitalize="characters" autoComplete="off" spellCheck={false} autoFocus
            />
          </Field>
          <label className={`check ${consent ? 'on' : ''}`}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="small bold">{t('consent')}</span>
          </label>
          {fetchErr && <div className={`banner ${fetchErr.code === 'consent' ? 'warn' : 'err'}`}>{fetchErrText}</div>}
          <button type="button" className="btn primary lg block" onClick={fetchRc} disabled={phase === 'fetching' || !reg}>
            {phase === 'fetching' ? <><span className="spinner" /> {t('fetching')}</> : <><Icon name="search" /> {t('fetchDetails')}</>}
          </button>
          <button type="button" className="btn ghost block" onClick={manual} disabled={!reg}>{t('manualEntry')}</button>
        </div>
      </div>
    );
  }

  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <form className="stack" onSubmit={save}>
      <PageHeader title={displayRegNo(check.regNo)} />
      {rc && (
        <div className="banner ok">
          ✓ {t('fetchedFrom', { when: timeAgo(rc.fetchedAt, lang) })}{rc.cached ? ` · ${t('fromCache')}` : ''}
        </div>
      )}
      {rc?.alreadyInTenant && (
        <div className="banner warn row">
          <span className="spacer">{t('alreadyAdded')}</span>
          {rc.existingVehicleId && <Link className="btn sm" to={`/vehicles/${rc.existingVehicleId}`}>{t('openVehicle')}</Link>}
        </div>
      )}
      {v.blacklisted && <div className="banner err">⚠ {t('blacklisted')}: {rc?.normalized?.blacklistStatus}</div>}
      {rc && <div className="hint">{t('reviewDetails')}</div>}

      {docs.length > 0 && (
        <div className="card stack" style={{ gap: 8 }}>
          <h3>{t('section_docs')}</h3>
          {docs.map((d) => (
            <div className="row" key={d.type}>
              <div className="spacer"><div className="bold small">{t(`doc_${d.type}`)}</div>{d.sub && <div className="tiny muted">{d.sub}</div>}</div>
              <ExpiryPill date={d.expiry} />
            </div>
          ))}
        </div>
      )}

      <div className="card stack">
        <h3>{t('owner')}</h3>
        <div className="seg">
          <button type="button" className={custMode === 'new' ? 'on' : ''} onClick={() => setCustMode('new')}>{t('newCustomer')}</button>
          <button type="button" className={custMode === 'existing' ? 'on' : ''} onClick={() => setCustMode('existing')}>{t('existingCustomer')}</button>
        </div>
        {custMode === 'existing' ? <CustomerPicker value={existing} onPick={setExisting} /> : <CustomerFields value={newCust} onChange={setNewCust} compact />}
      </div>

      <div className="card stack">
        <Field label={t('vehicleType')}>
          <div className="chips">
            {VEHICLE_TYPES.map((k) => (
              <button type="button" key={k} className={`chip ${v.vehicleType === k ? 'on' : ''}`} onClick={() => setV({ ...v, vehicleType: k })}>{t(`vt_${k}`)}</button>
            ))}
          </div>
        </Field>
      </div>

      {Object.entries(SECTIONS).map(([sec, keys]) => (
        <details className="card" key={sec} open={sec !== 'section_owner' || !rc}>
          <summary>{t(sec)}</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            {keys.map((k) => (
              <Field key={k} label={t(k)}>
                {LONG_FIELDS.has(k) ? (
                  <textarea className="input" value={v[k] ?? ''} onChange={set(k)} rows={2} />
                ) : (
                  <input
                    className="input" value={v[k] ?? ''} onChange={set(k)}
                    type={DATE_FIELDS.has(k) ? 'date' : 'text'} inputMode={NUM_FIELDS.has(k) ? 'numeric' : undefined}
                  />
                )}
              </Field>
            ))}
          </div>
        </details>
      ))}

      {saveErr && <div className="banner err">{errorText(t, saveErr)}</div>}
      <button className="btn primary lg block" disabled={saving || (custMode === 'existing' ? !existing : !newCust.name)}>
        {saving ? <span className="spinner" /> : t('saveVehicle')}
      </button>
    </form>
  );
}
