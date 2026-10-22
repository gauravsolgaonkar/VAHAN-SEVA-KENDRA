import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import CommissionFields from '../components/CommissionFields.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, ErrorBox, ExpiryPill, Field, Loading, PageHeader, Plate, useToast } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { fmtDate, insuranceEnd, pucEnd, telLink, toInputDate, waLink } from '../util.js';
import { CaseChip } from './Pipeline.jsx';

const OPEN = ['pending', 'contacted', 'quote_sent'];
const LOST_REASONS = ['price', 'renewed_elsewhere', 'vehicle_sold', 'other'];
const INS = new Set(['insurance', 'health', 'life']);
const num = (x) => (x === '' || x === null || x === undefined ? undefined : Number(x));
const when = (d) => `${fmtDate(d)} ${new Date(d).toTimeString().slice(0, 5)}`;

function RenewForm({ c, onDone }) {
  const { t } = useI18n();
  const old = c.document || {};
  const startDefault = old.expiryDate ? toInputDate(new Date(new Date(old.expiryDate).getTime() + 86400000)) : toInputDate(new Date());
  const endFor = (s) => (s ? toInputDate(INS.has(c.docType) ? insuranceEnd(s) : c.docType === 'puc' ? pucEnd(s, c.vehicle || {}) : '') : '');
  const [f, setF] = useState({
    number: '', provider: old.provider || '', startDate: startDefault, expiryDate: endFor(startDefault), amount: '', paymentMode: 'cash',
    insurance: { policyType: old.insurance?.policyType || null, totalPremium: '', odPremium: '', tpPremium: '', idv: '', ncb: '' },
    commission: { type: old.commission?.type || null, rate: old.commission?.rate ?? '', platform: old.commission?.platform || '', payoutReceived: false },
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setIns = (k) => (e) => setF({ ...f, insurance: { ...f.insurance, [k]: e.target.value.replace(/[^\d.]/g, '') } });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const ins = INS.has(c.docType) ? {
      policyType: f.insurance.policyType, totalPremium: num(f.insurance.totalPremium), odPremium: num(f.insurance.odPremium),
      tpPremium: num(f.insurance.tpPremium), idv: num(f.insurance.idv), ncb: num(f.insurance.ncb),
    } : undefined;
    try {
      const res = await api(`/pipeline/${c._id}/renew`, {
        method: 'POST',
        body: {
          number: f.number || undefined, provider: f.provider || undefined, startDate: f.startDate || undefined, expiryDate: f.expiryDate || undefined,
          amount: num(f.amount), paymentMode: f.paymentMode, insurance: ins,
          commission: INS.has(c.docType) && f.commission.type ? { ...f.commission, rate: num(f.commission.rate) } : undefined,
        },
      });
      onDone(res);
    } catch (ex) {
      setErr(ex);
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={save}>
      <h3 style={{ margin: 0 }}>{t('newPolicy')}</h3>
      {c.docType === 'insurance' && (
        <div className="seg">
          {['TP', 'OD', 'COMPREHENSIVE'].map((p) => (
            <button type="button" key={p} className={f.insurance.policyType === p ? 'on' : ''} onClick={() => setF({ ...f, insurance: { ...f.insurance, policyType: p } })}>
              {p === 'COMPREHENSIVE' ? 'Comp.' : p}
            </button>
          ))}
        </div>
      )}
      <Field label={t('provider')}><input className="input" value={f.provider} onChange={set('provider')} /></Field>
      <Field label={t('number')}><input className="input" value={f.number} onChange={set('number')} /></Field>
      <div className="grid2">
        <Field label={t('startDate')}><input className="input" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, expiryDate: endFor(e.target.value) || f.expiryDate })} /></Field>
        <Field label={t('expiryDate')}><input className="input" type="date" value={f.expiryDate} onChange={set('expiryDate')} /></Field>
      </div>
      {INS.has(c.docType) ? (
        <>
          <div className="grid2">
            <Field label={t('totalPremium')}><input className="input" inputMode="numeric" value={f.insurance.totalPremium} onChange={setIns('totalPremium')} /></Field>
            {c.docType === 'insurance' && <Field label={t('odPremium')}><input className="input" inputMode="numeric" value={f.insurance.odPremium} onChange={setIns('odPremium')} /></Field>}
            {c.docType === 'insurance' && <Field label={t('tpPremium')}><input className="input" inputMode="numeric" value={f.insurance.tpPremium} onChange={setIns('tpPremium')} /></Field>}
            {c.docType === 'insurance' && <Field label={t('idv')}><input className="input" inputMode="numeric" value={f.insurance.idv} onChange={setIns('idv')} /></Field>}
          </div>
          <div className="section-title" style={{ margin: 0 }}><h2>{t('commission')}</h2></div>
          <CommissionFields value={f.commission} insurance={f.insurance} onChange={(commission) => setF({ ...f, commission })} />
        </>
      ) : (
        <Field label={t('amount')}><input className="input" inputMode="numeric" value={f.amount} onChange={set('amount')} /></Field>
      )}
      <Field label={t('paymentMode')}>
        <div className="seg">
          {['cash', 'upi', 'card', 'other'].map((m) => <button type="button" key={m} className={f.paymentMode === m ? 'on' : ''} onClick={() => setF({ ...f, paymentMode: m })}>{t(`pm_${m}`)}</button>)}
        </div>
      </Field>
      {err && <div className="banner err">{errorText(t, err)}</div>}
      <button className="btn primary lg block" disabled={busy}>{busy ? <span className="spinner" /> : t('saveRenewal')}</button>
    </form>
  );
}

export default function PipelineCase() {
  const { id } = useParams();
  const { t } = useI18n();
  const { canWrite } = useAuth();
  const { data: c, loading, error, reload } = useApi(`/pipeline/${id}`, [id]);
  const [lostOpen, setLostOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, setToast, toastEl] = useToast();

  if (loading && !c) return <Loading />;
  if (error && !c) return <ErrorBox error={error} onRetry={reload} />;

  const patch = async (body) => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/pipeline/${id}`, { method: 'PATCH', body });
      setLostOpen(false);
      reload();
      return true;
    } catch (ex) {
      setErr(ex);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const isOpen = OPEN.includes(c.status);
  const phone = c.customer?.whatsapp || c.customer?.mobile;
  return (
    <div className="stack">
      <PageHeader title={t('pipeline')} right={<CaseChip status={c.status} />} />

      <div className="card stack" style={{ gap: 8 }}>
        <div className="row">
          <Link to={`/customers/${c.customerId}`} className="spacer" style={{ minWidth: 0 }}>
            <div className="bold" style={{ fontSize: '1.1rem' }}>{c.customer?.name}</div>
            <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
              {c.vehicle && <Plate regNo={c.vehicle.regNo} />}
              <span className="small bold">{t(`doc_${c.docType}`)}</span>
            </div>
          </Link>
          {c.customer?.mobile && <a className="round-btn call" href={telLink(c.customer.mobile)} aria-label={t('call')}><Icon name="phone" /></a>}
          {phone && <a className="round-btn wa" href={waLink(phone)} target="_blank" rel="noreferrer" aria-label={t('whatsapp')}><Icon name="whatsapp" /></a>}
        </div>
        {c.document && (
          <Link to={`/documents/${c.document._id}`} className="row small" style={{ background: 'var(--bg)', borderRadius: 10, padding: 10 }}>
            <span className="spacer">{c.document.provider || '—'}{c.document.number ? ` · ${c.document.number}` : ''}</span>
            <ExpiryPill date={c.document.expiryDate} archived={c.document.status === 'archived'} />
          </Link>
        )}
        {c.status === 'lost' && c.lostReason && <div className="banner err">{t('lostReason')}: {t(`lr_${c.lostReason}`)}</div>}
        {c.renewedDocument && (
          <Link to={`/documents/${c.renewedDocument._id}`} className="banner ok row">
            <span className="spacer">{t('renewed')}: {c.renewedDocument.provider || ''} {c.renewedDocument.number || ''} → {fmtDate(c.renewedDocument.expiryDate)}</span>
            {c.renewedDocument.commission?.amount ? <span className="bold">₹{c.renewedDocument.commission.amount.toLocaleString('en-IN')}</span> : null}
          </Link>
        )}
      </div>

      {canWrite && isOpen && !renewOpen && (
        <div className="card stack" style={{ gap: 10 }}>
          <div className="status-btns">
            {OPEN.map((s) => (
              <button key={s} type="button" disabled={busy} className={`btn ${c.status === s ? 'on blue' : ''}`} onClick={() => c.status !== s && patch({ status: s })}>{t(`cs_${s}`)}</button>
            ))}
          </div>
          <div className="grid2">
            <button type="button" className="btn primary" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => setRenewOpen(true)}><Icon name="check" /> {t('renewed')}</button>
            <button type="button" className="btn danger" onClick={() => setLostOpen(!lostOpen)}><Icon name="x" /> {t('lost')}</button>
          </div>
          {lostOpen && (
            <div className="stack" style={{ gap: 8 }}>
              <div className="small bold">{t('lostReason')}</div>
              <div className="chips">
                {LOST_REASONS.map((r) => <button key={r} type="button" className="chip" disabled={busy} onClick={() => patch({ status: 'lost', lostReason: r })}>{t(`lr_${r}`)}</button>)}
              </div>
            </div>
          )}
          <div className="grid2">
            <Field label={t('followUpDate')}>
              <input className="input" type="date" value={toInputDate(c.followUpDate)} onChange={(e) => patch({ followUpDate: e.target.value || null })} />
            </Field>
            <Field label={t('quoteAmount')}>
              <input className="input" inputMode="numeric" defaultValue={c.quoteAmount ?? ''} onBlur={(e) => String(c.quoteAmount ?? '') !== e.target.value && patch({ quoteAmount: e.target.value })} />
            </Field>
          </div>
        </div>
      )}
      {canWrite && renewOpen && (
        <>
          <RenewForm c={c} onDone={() => { setRenewOpen(false); setToast(t('renewedOk')); reload(); }} />
          <button type="button" className="btn ghost block" onClick={() => setRenewOpen(false)}>{t('cancel')}</button>
        </>
      )}
      {canWrite && !isOpen && c.status === 'lost' && (
        <button type="button" className="btn block" disabled={busy} onClick={() => patch({ status: 'contacted' })}>{t('cs_contacted')} ↺</button>
      )}
      {err && <div className="banner err">{errorText(t, err)}</div>}

      <div className="section-title"><h2>{t('callNotes')}</h2></div>
      <div className="card stack" style={{ gap: 10 }}>
        {canWrite && (
          <form className="row" onSubmit={async (e) => { e.preventDefault(); if (note.trim() && await patch({ note })) setNote(''); }}>
            <input className="input spacer" value={note} placeholder={t('addNote')} onChange={(e) => setNote(e.target.value)} />
            <button className="btn blue" disabled={busy || !note.trim()}><Icon name="plus" /></button>
          </form>
        )}
        {c.notes.length === 0 ? <div className="small muted">—</div> : (
          <div className="timeline">
            {[...c.notes].reverse().map((n) => (
              <div key={n._id}>
                <div>{n.text}</div>
                <div className="tiny muted">{when(n.at)}{n.by?.name ? ` · ${n.by.name}` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {c.renewalChecks?.length > 0 && (
        <>
          <div className="section-title"><h2>{t('renewalChecks')}</h2></div>
          <div className="card flush">
            <div className="list">
              {c.renewalChecks.map((r, i) => (
                <div className="list-item" key={i}>
                  <div className="main"><div className="t small">{when(r.at)}</div><div className="s">{r.window === 'pre' ? '−5…−3' : '+1…+3'}</div></div>
                  <span className={`pill ${r.result === 'renewed_elsewhere' ? 'expired' : r.result === 'renewed_us' ? 'active' : 'none'}`}>
                    {r.result === 'renewed_elsewhere' ? t('lr_renewed_elsewhere') : r.result === 'renewed_us' ? t('renewed') : r.result === 'not_yet' ? t('cs_pending') : t('failed')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="section-title"><h2>{t('statusHistory')}</h2></div>
      <div className="card">
        <div className="timeline">
          {[...c.history].reverse().map((h) => (
            <div key={h._id}>
              <CaseChip status={h.status} />
              <span className="tiny muted" style={{ marginLeft: 8 }}>{when(h.at)}{h.auto ? ` · ${t('auto')}` : h.by?.name ? ` · ${h.by.name}` : ''}</span>
            </div>
          ))}
        </div>
      </div>
      {toastEl}
    </div>
  );
}
