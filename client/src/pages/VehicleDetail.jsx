import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, ErrorBox, ExpiryPill, Loading, PageHeader, Plate, useToast } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { fmtDate, telLink, timeAgo, waLink } from '../util.js';

const SHOW = ['ownerName', 'fatherName', 'maker', 'model', 'variant', 'bodyType', 'vehicleClass', 'fuel', 'norms', 'colour', 'seatingCapacity',
  'grossWeight', 'unladenWeight', 'manufacturingYear', 'registrationDate', 'rcValidUpto', 'chassisNo', 'engineNo', 'rto', 'financer', 'rcStatus', 'presentAddress'];
const DATES = new Set(['registrationDate', 'rcValidUpto']);

function RawJson({ id }) {
  const { t } = useI18n();
  const [raw, setRaw] = useState(null);
  return (
    <details className="card" onToggle={(e) => e.target.open && !raw && api(`/rc/records/${id}`).then(setRaw).catch(() => {})}>
      <summary>{t('rawJson')}</summary>
      {raw ? <pre className="raw">{JSON.stringify(raw.raw, null, 2)}</pre> : <div className="small muted">{t('loading')}</div>}
    </details>
  );
}

export default function VehicleDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { t, lang } = useI18n();
  const { canWrite } = useAuth();
  const { data: v, loading, error, reload } = useApi(`/vehicles/${id}`, [id]);
  const [consent, setConsent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshErr, setRefreshErr] = useState(null);
  const [, setToast, toast] = useToast();
  const created = params.get('created');

  if (loading && !v) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const active = v.documents.filter((d) => d.status === 'active');
  const history = v.documents.filter((d) => d.status === 'archived');
  const phone = v.customer?.whatsapp || v.customer?.mobile;

  async function refresh() {
    if (!consent) return setRefreshErr({ code: 'consent' });
    setRefreshing(true);
    setRefreshErr(null);
    try {
      await api(`/vehicles/${id}/refresh-rc`, { method: 'POST', body: { consent: true } });
      setConsent(false);
      setToast(t('refreshed'));
      reload();
    } catch (e) {
      setRefreshErr(e);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader title={<Plate regNo={v.regNo} lg />} />
      {created !== null && <div className="banner ok">✓ {t('savedWithDocs', { n: created })}</div>}
      {v.blacklisted && <div className="banner err">⚠ {t('blacklisted')}</div>}

      <Link to={`/customers/${v.customer?._id}`} className="card row">
        <div className="avatar">{v.customer?.name?.[0]}</div>
        <div className="spacer">
          <div className="bold">{v.customer?.name}</div>
          <div className="small muted">{t(`vt_${v.vehicleType}`)} · {[v.maker?.split(' ')[0], v.model].filter(Boolean).join(' ')}</div>
        </div>
        {v.customer?.mobile && <a className="round-btn call" href={telLink(v.customer.mobile)} onClick={(e) => e.stopPropagation()}><Icon name="phone" /></a>}
        {phone && <a className="round-btn wa" href={waLink(phone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Icon name="whatsapp" /></a>}
      </Link>

      <div className="section-title">
        <h2>{t('documents')}</h2>
        {canWrite && <Link to={`/documents/new?vehicleId=${id}`} className="btn sm primary"><Icon name="plus" size={18} /> {t('addDocument')}</Link>}
      </div>
      <div className="card flush">
        {active.length === 0 ? <div className="empty small">—</div> : (
          <div className="list">
            {active.map((d) => (
              <Link to={`/documents/${d._id}`} className="list-item" key={d._id}>
                <div className="main">
                  <div className="t">{t(`doc_${d.type}`)} {d.files?.length > 0 && <Icon name="paperclip" size={14} />}</div>
                  <div className="s">{[d.provider, d.number, d.expiryDate && fmtDate(d.expiryDate)].filter(Boolean).join(' · ')}</div>
                </div>
                <ExpiryPill date={d.expiryDate} />
              </Link>
            ))}
          </div>
        )}
      </div>
      {history.length > 0 && (
        <details className="card">
          <summary>{t('history')} ({history.length})</summary>
          <div className="list">
            {history.map((d) => (
              <Link to={`/documents/${d._id}`} className="list-item" key={d._id} style={{ paddingLeft: 0, paddingRight: 0 }}>
                <div className="main"><div className="t">{t(`doc_${d.type}`)}</div><div className="s">{[d.provider, d.number, fmtDate(d.expiryDate)].filter(Boolean).join(' · ')}</div></div>
                <ExpiryPill archived />
              </Link>
            ))}
          </div>
        </details>
      )}

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row">
          <span className="small muted spacer">
            {t('lastFetched')}: {v.rcFetchedAt ? `${timeAgo(v.rcFetchedAt, lang)}${v.rc?.provider ? ` (${v.rc.provider})` : ''}` : t('never')}
          </span>
        </div>
        {canWrite && (
          <>
            <label className={`check ${consent ? 'on' : ''}`}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="small bold">{t('consent')}</span>
            </label>
            {refreshErr && <div className={`banner ${refreshErr.code === 'consent' ? 'warn' : 'err'}`}>{refreshErr.code === 'consent' ? t('consentNeeded') : refreshErr.code?.startsWith('rc_') ? t('rcFailed') : errorText(t, refreshErr)}</div>}
            <button type="button" className="btn blue block" onClick={refresh} disabled={refreshing}>
              {refreshing ? <><span className="spinner" /> {t('fetching')}</> : <><Icon name="refresh" /> {t('refresh')}</>}
            </button>
          </>
        )}
      </div>

      <details className="card" open>
        <summary>{t('section_vehicle')}</summary>
        <div className="kv" style={{ marginTop: 10 }}>
          {SHOW.filter((k) => v[k] !== undefined && v[k] !== null && v[k] !== '').map((k) => (
            <span key={k} style={{ display: 'contents' }}>
              <span className="k">{t(k)}</span>
              <span className={`v ${['chassisNo', 'engineNo'].includes(k) ? 'mono' : ''}`}>{DATES.has(k) ? fmtDate(v[k]) : String(v[k])}</span>
            </span>
          ))}
        </div>
      </details>
      {v.rcRecordId && <RawJson id={v.rcRecordId} />}
      {toast}
    </div>
  );
}
