import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { ErrorBox, ExpiryPill, Loading, Plate } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { daysUntil, fmtDate, telLink } from '../util.js';

const TABS = [
  { key: 'open', q: 'status=open' },
  { key: 'followUps', q: 'status=open&followUp=due' },
  { key: 'renewed', q: 'status=renewed' },
  { key: 'lost', q: 'status=lost' },
];

export function CaseChip({ status, id }) {
  const { t } = useI18n();
  if (!status) return null;
  const pill = <span className={`pill cs-${status}`}>{t(`cs_${status}`)}</span>;
  return id ? <Link to={`/pipeline/${id}`}>{pill}</Link> : pill;
}

function FollowUp({ date }) {
  const { t } = useI18n();
  if (!date) return null;
  const d = daysUntil(date);
  const label = d < 0 ? t('overdue') : d === 0 ? t('followUpToday') : fmtDate(date);
  return <span className={`pill ${d < 0 ? 'expired' : d === 0 ? 'due7' : 'none'}`}>⏰ {label}</span>;
}

function Summary() {
  const { t } = useI18n();
  const { data } = useApi('/pipeline/summary');
  if (!data) return null;
  const s = data.open;
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="grid3" style={{ gap: 0 }}>
        <div className="stat center"><div className="k" style={{ color: 'var(--amber)' }}>{s.pending}</div><div className="l">{t('cs_pending')}</div></div>
        <div className="stat center"><div className="k" style={{ color: 'var(--blue-2)' }}>{s.contacted}</div><div className="l">{t('cs_contacted')}</div></div>
        <div className="stat center"><div className="k" style={{ color: 'var(--blue-2)' }}>{s.quote_sent}</div><div className="l">{t('cs_quote_sent')}</div></div>
      </div>
      <div className="row small" style={{ borderTop: '1px solid var(--line)', padding: '8px 12px' }}>
        <span className="spacer muted bold">{t('wonLostMonth')}</span>
        <span className="pill cs-renewed">{t('renewed')} {data.month.renewed}</span>
        <span className="pill cs-lost">{t('lost')} {data.month.lost}</span>
      </div>
    </div>
  );
}

/** Renewal pipeline list. Embedded in the Due List and also reachable at /pipeline. */
export function PipelineList() {
  const { t } = useI18n();
  const [tab, setTab] = useState('open');
  const q = TABS.find((x) => x.key === tab).q;
  const { data, loading, error, reload } = useApi(`/pipeline?${q}`, [q]);
  return (
    <div className="stack">
      <Summary />
      <div className="chips">
        {TABS.map((x) => <button key={x.key} type="button" className={`chip ${tab === x.key ? 'on' : ''}`} onClick={() => setTab(x.key)}>{t(x.key)}</button>)}
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? (
        <div className="card empty">{t('noCases')}</div>
      ) : (
        <div className="card flush">
          <div className="list">
            {data.map((c) => (
              <div className="list-item" key={c._id}>
                <Link to={`/pipeline/${c._id}`} className="main">
                  <div className="t">{c.customer?.name}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                    {c.vehicle && <Plate regNo={c.vehicle.regNo} />}
                    <span className="small bold">{t(`doc_${c.docType}`)}</span>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <CaseChip status={c.status} />
                    {c.status === 'lost' && c.lostReason && <span className="pill none">{t(`lr_${c.lostReason}`)}</span>}
                    {['renewed', 'lost'].includes(c.status) ? null : <ExpiryPill date={c.expiryDate} />}
                    {!['renewed', 'lost'].includes(c.status) && <FollowUp date={c.followUpDate} />}
                  </div>
                </Link>
                {c.customer?.mobile && !['renewed', 'lost'].includes(c.status) && (
                  <a className="round-btn call" href={telLink(c.customer.mobile)} aria-label={t('call')}><Icon name="phone" /></a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Pipeline() {
  const { t } = useI18n();
  return (
    <div className="stack">
      <h2 style={{ fontSize: '1.2rem' }}>{t('pipeline')}</h2>
      <PipelineList />
    </div>
  );
}
