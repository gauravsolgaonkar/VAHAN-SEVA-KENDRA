import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, Field, PageHeader, Plate, useToast } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { displayRegNo, fmtDate, pucEnd, toInputDate, validateRegNo, VEHICLE_TYPES } from '../util.js';

const inr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const titleCase = (s = '') => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function rateFor(tenant, vehicleType) {
  const rates = tenant?.settings?.pucRates || {};
  return rates[vehicleType] ?? rates.default ?? 100;
}

function blank(tenant) {
  const today = toInputDate(new Date());
  return { reg: '', rc: null, name: '', mobile: '', certNo: '', issueDate: today, expiryDate: toInputDate(pucEnd(today)), vehicleType: 'car', fuel: '', amount: String(rateFor(tenant, 'car')), paymentMode: 'cash' };
}

/** PUC centre counter screen: reg no. -> optional RC fetch -> certificate + cash, then straight to the next vehicle. */
export default function PucEntry() {
  const { t } = useI18n();
  const { tenant, setTenant, canWrite } = useAuth();
  const day = useApi('/puc/day');
  const [f, setF] = useState(() => blank(tenant));
  const [consent, setConsent] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, setToast, toastEl] = useToast();
  const regRef = useRef(null);
  const check = validateRegNo(f.reg);

  const fetchRc = async () => {
    setFetching(true);
    setErr(null);
    try {
      const rc = await api('/rc/lookup', { method: 'POST', body: { regNo: check.regNo, consent: true } });
      const n = rc.normalized || {};
      const vt = n.vehicleType || 'other';
      const start = f.issueDate || toInputDate(new Date());
      setF((x) => ({
        ...x, rc, name: titleCase(n.ownerName || ''), vehicleType: vt, fuel: n.fuel || '',
        amount: String(rateFor(tenant, vt)), expiryDate: toInputDate(pucEnd(start, { fuel: n.fuel || '', norms: n.norms || '' })),
      }));
      if (!rc.cached) setTenant({ ...tenant, rcCredits: Math.max(0, (tenant.rcCredits || 0) - 1) });
    } catch (ex) {
      setErr(ex);
    } finally {
      setFetching(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api('/puc/entry', {
        method: 'POST',
        body: {
          regNo: check.regNo, rcRecordId: f.rc?.rcRecordId, customerName: f.name, mobile: f.mobile, certNo: f.certNo,
          issueDate: f.issueDate, expiryDate: f.expiryDate, amount: Number(f.amount) || 0, paymentMode: f.paymentMode,
          vehicleType: f.vehicleType, fuel: f.fuel || undefined,
        },
      });
      setToast(`${t('pucSaved')} · ${displayRegNo(check.regNo)}`);
      setF(blank(tenant));
      setConsent(false);
      day.reload();
      setTimeout(() => regRef.current?.focus(), 50);
    } catch (ex) {
      setErr(ex);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setType = (vt) => setF({ ...f, vehicleType: vt, amount: String(rateFor(tenant, vt)) });
  const totals = day.data?.totals;
  const n = f.rc?.normalized;

  return (
    <div className="stack">
      <PageHeader title={t('pucEntry')} />
      <div className="card" style={{ padding: 0 }}>
        <div className="grid3" style={{ gap: 0 }}>
          <div className="stat center"><div className="k">{totals?.count ?? '·'}</div><div className="l">{t('pucToday')}</div></div>
          <div className="stat center"><div className="k" style={{ color: 'var(--green)' }}>{inr(totals?.cash)}</div><div className="l">{t('cashToday')}</div></div>
          <div className="stat center"><div className="k">{inr(totals?.total)}</div><div className="l">{t('totalToday')}</div></div>
        </div>
      </div>

      <form className="card stack" onSubmit={save} style={{ gap: 12 }}>
        <input
          ref={regRef} autoFocus className={`input reg big-input ${f.reg && !check.ok ? 'invalid' : ''}`} placeholder="MH 08 AB 1234"
          value={displayRegNo(f.reg)} onChange={(e) => setF({ ...f, reg: e.target.value, rc: null })} autoCapitalize="characters" autoComplete="off"
          disabled={!canWrite}
        />
        {check.ok && !f.rc && (
          <div className="stack" style={{ gap: 8 }}>
            <label className={`check ${consent ? 'on' : ''}`}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="small">{t('consent')}</span>
            </label>
            <button type="button" className="btn blue block" disabled={!consent || fetching} onClick={fetchRc}>
              {fetching ? <span className="spinner" /> : <><Icon name="refresh" /> {t('quickFetch')} (1 {t('credits')})</>}
            </button>
          </div>
        )}
        {n && (
          <div className="banner ok small">
            <div className="bold">{titleCase(n.ownerName || '')}</div>
            <div>{[n.maker, n.model].filter(Boolean).join(' ')} · {n.fuel} · {n.norms}</div>
            {f.rc.existingVehicleId && <Link to={`/vehicles/${f.rc.existingVehicleId}`} className="tiny bold">{t('alreadyAdded2')} →</Link>}
          </div>
        )}
        {check.ok && (
          <>
            {!n && (
              <div className="chips">
                {VEHICLE_TYPES.filter((v) => ['2W', 'car', 'auto', 'pickup', 'truck', 'bus', 'tractor'].includes(v)).map((v) => (
                  <button type="button" key={v} className={`chip ${f.vehicleType === v ? 'on' : ''}`} onClick={() => setType(v)}>{t(`vt_${v}`)}</button>
                ))}
              </div>
            )}
            <div className="grid2">
              <Field label={t('certNo')}><input className="input" value={f.certNo} onChange={set('certNo')} /></Field>
              <Field label={t('amount')}><input className="input" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ fontWeight: 800 }} /></Field>
            </div>
            <div className="seg">
              {['cash', 'upi'].map((m) => <button type="button" key={m} className={f.paymentMode === m ? 'on' : ''} onClick={() => setF({ ...f, paymentMode: m })}>{t(`pm_${m}`)}</button>)}
            </div>
            <div className="grid2">
              <Field label={t('mobile')}><input className="input" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></Field>
              <Field label={t('validTill')}><input className="input" type="date" value={f.expiryDate} onChange={set('expiryDate')} /></Field>
            </div>
            {!n && <Field label={t('name')}><input className="input" value={f.name} onChange={set('name')} /></Field>}
            <button className="btn primary lg block" disabled={busy || !canWrite}>{busy ? <span className="spinner" /> : `${t('savePuc')} · ${inr(f.amount)}`}</button>
          </>
        )}
        {err && <div className="banner err">{errorText(t, err)}</div>}
      </form>

      {day.data?.entries.length > 0 && (
        <>
          <div className="section-title"><h2>{t('todaysEntries')}</h2></div>
          <div className="card flush">
            <div className="list">
              {day.data.entries.map((d) => (
                <Link key={d._id} className="list-item" to={`/vehicles/${d.vehicleId}`}>
                  <div className="main">
                    <Plate regNo={d.vehicle?.regNo || ''} />
                    <div className="s" style={{ marginTop: 4 }}>{new Date(d.bookedAt).toTimeString().slice(0, 5)} · {t('validTill')} {fmtDate(d.expiryDate)}{d.number ? ` · ${d.number}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="bold">{inr(d.amount)}</div>
                    <div className="tiny muted">{t(`pm_${d.paymentMode || 'cash'}`)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
      {toastEl}
    </div>
  );
}
