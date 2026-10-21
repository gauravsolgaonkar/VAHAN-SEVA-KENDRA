import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, openFile } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, ExpiryPill, Field, Loading, PageHeader } from '../components/ui.jsx';
import { useI18n } from '../i18n.jsx';
import { insuranceEnd, PERSONAL_DOC_TYPES, pucEnd, toInputDate, VEHICLE_DOC_TYPES } from '../util.js';

const empty = { type: 'insurance', number: '', provider: '', issueDate: '', startDate: '', expiryDate: '', amount: '', permitType: '', notes: '', insurance: { policyType: null } };
const INS_TYPES = new Set(['insurance', 'health', 'life']);

export default function DocumentForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { t } = useI18n();
  const { canWrite, isOwner } = useAuth();
  const nav = useNavigate();
  const vehicleId = params.get('vehicleId');
  const customerId = params.get('customerId');
  const [d, setD] = useState(id ? null : { ...empty, type: params.get('type') || (vehicleId ? 'insurance' : 'health') });
  const [vehicle, setVehicle] = useState(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!id) return;
    api(`/documents/${id}`).then((doc) => {
      setD({
        ...empty, ...doc,
        issueDate: toInputDate(doc.issueDate), startDate: toInputDate(doc.startDate), expiryDate: toInputDate(doc.expiryDate),
        amount: doc.amount ?? '', insurance: doc.insurance || { policyType: null },
      });
    }).catch(setErr);
  }, [id]);

  const vId = vehicleId || d?.vehicleId;
  useEffect(() => {
    if (vId) api(`/vehicles/${vId}`).then(setVehicle).catch(() => {});
  }, [vId]);

  if (!d) return err ? <div className="banner err">{errorText(t, err)}</div> : <Loading />;

  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const setIns = (k) => (e) => setD({ ...d, insurance: { ...d.insurance, [k]: e.target.value } });
  const isVehicleDoc = Boolean(vId);
  const types = isVehicleDoc ? VEHICLE_DOC_TYPES : PERSONAL_DOC_TYPES;

  function onStart(e) {
    const startDate = e.target.value;
    const next = { ...d, startDate };
    if (startDate && (!d.expiryDate || autoFilled)) {
      let end = null;
      if (INS_TYPES.has(d.type)) end = insuranceEnd(startDate);
      else if (d.type === 'puc') end = pucEnd(startDate, { fuel: vehicle?.fuel || '', norms: vehicle?.norms || '' });
      if (end) {
        next.expiryDate = toInputDate(end);
        setAutoFilled(true);
      }
    }
    setD(next);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const num = (x) => (x === '' || x === null || x === undefined ? undefined : Number(x));
    const body = {
      type: d.type, number: d.number, provider: d.provider, permitType: d.permitType || undefined, notes: d.notes,
      issueDate: d.issueDate || undefined, startDate: d.startDate || undefined, expiryDate: d.expiryDate || undefined, amount: num(d.amount),
      insurance: INS_TYPES.has(d.type) ? {
        policyType: d.insurance.policyType || null, idv: num(d.insurance.idv), ncb: num(d.insurance.ncb),
        totalPremium: num(d.insurance.totalPremium), odPremium: num(d.insurance.odPremium), tpPremium: num(d.insurance.tpPremium),
      } : undefined,
    };
    try {
      const saved = id
        ? await api(`/documents/${id}`, { method: 'PATCH', body })
        : await api('/documents', { method: 'POST', body: { ...body, vehicleId: vehicleId || undefined, customerId: customerId || undefined } });
      if (file) {
        const form = new FormData();
        form.append('file', file);
        await api(`/documents/${saved._id}/files`, { method: 'POST', form });
      }
      nav(-1);
    } catch (ex) {
      setErr(ex);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t('delete') + '?')) return;
    await api(`/documents/${id}`, { method: 'DELETE' });
    nav(-1);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <PageHeader title={id ? t(`doc_${d.type}`) : t('addDocument')} right={id && <ExpiryPill date={d.expiryDate} archived={d.status === 'archived'} />} />
      <fieldset disabled={!canWrite} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        {!id && (
          <div className="card">
            <Field label={t('docType')}>
              <div className="chips">
                {types.map((k) => (
                  <button type="button" key={k} className={`chip ${d.type === k ? 'on' : ''}`} onClick={() => setD({ ...d, type: k })}>{t(`doc_${k}`)}</button>
                ))}
              </div>
            </Field>
          </div>
        )}
        <div className="card stack">
          {INS_TYPES.has(d.type) && d.type === 'insurance' && (
            <Field label={t('policyType')}>
              <div className="seg">
                {['TP', 'OD', 'COMPREHENSIVE'].map((p) => (
                  <button type="button" key={p} className={d.insurance.policyType === p ? 'on' : ''} onClick={() => setD({ ...d, insurance: { ...d.insurance, policyType: p } })}>
                    {p === 'COMPREHENSIVE' ? 'Comp.' : p}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label={t('provider')}><input className="input" value={d.provider || ''} onChange={set('provider')} /></Field>
          <Field label={t('number')}><input className="input" value={d.number || ''} onChange={set('number')} /></Field>
          {d.type === 'permit' && <Field label={t('permitType')}><input className="input" value={d.permitType || ''} onChange={set('permitType')} /></Field>}
          <div className="grid2">
            <Field label={t('startDate')}><input className="input" type="date" value={d.startDate} onChange={onStart} /></Field>
            <Field label={t('expiryDate')} hint={autoFilled ? t('autoExpiry') : undefined}>
              <input className="input" type="date" value={d.expiryDate} onChange={(e) => { setAutoFilled(false); set('expiryDate')(e); }} />
            </Field>
          </div>
          {INS_TYPES.has(d.type) ? (
            <>
              <div className="grid2">
                {d.type === 'insurance' && <Field label={t('idv')}><input className="input" inputMode="numeric" value={d.insurance.idv ?? ''} onChange={setIns('idv')} /></Field>}
                {d.type === 'insurance' && <Field label={t('ncb')}><input className="input" inputMode="numeric" value={d.insurance.ncb ?? ''} onChange={setIns('ncb')} /></Field>}
                <Field label={t('totalPremium')}><input className="input" inputMode="numeric" value={d.insurance.totalPremium ?? ''} onChange={setIns('totalPremium')} /></Field>
                {d.type === 'insurance' && <Field label={t('odPremium')}><input className="input" inputMode="numeric" value={d.insurance.odPremium ?? ''} onChange={setIns('odPremium')} /></Field>}
                {d.type === 'insurance' && <Field label={t('tpPremium')}><input className="input" inputMode="numeric" value={d.insurance.tpPremium ?? ''} onChange={setIns('tpPremium')} /></Field>}
              </div>
            </>
          ) : (
            <Field label={t('amount')}><input className="input" inputMode="numeric" value={d.amount} onChange={set('amount')} /></Field>
          )}
          <Field label={t('notes')}><textarea className="input" value={d.notes || ''} onChange={set('notes')} rows={2} /></Field>
        </div>
        <div className="card stack">
          <Field label={t('uploadFile')}>
            <input className="input" type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Field>
          {d.files?.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              {d.files.map((f, i) => (
                <button type="button" key={f.path} className="btn ghost sm" style={{ justifyContent: 'flex-start' }} onClick={() => openFile(`/documents/${id}/files/${i}`)}>
                  <Icon name="file" size={18} /> {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {err && <div className="banner err">{errorText(t, err)}</div>}
        {canWrite && <button className="btn primary lg block" disabled={busy}>{busy ? <span className="spinner" /> : t('save')}</button>}
      </fieldset>
      {id && isOwner && <button type="button" className="btn danger block" onClick={remove}>{t('delete')}</button>}
    </form>
  );
}
