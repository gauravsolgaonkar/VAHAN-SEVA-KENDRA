import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { ErrorBox, Loading } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { displayRegNo, fmtDate } from '../util.js';

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
  const [tab, setTab] = useState('rc');
  return (
    <div className="stack">
      <h2 style={{ fontSize: '1.2rem' }}>{t('reports')}</h2>
      <div className="banner info">{t('comingPhase2')}</div>
      {!isOwner ? <div className="card empty">{t('ownerOnly')}</div> : (
        <>
          <div className="seg">
            <button type="button" className={tab === 'rc' ? 'on' : ''} onClick={() => setTab('rc')}>{t('rcLog')}</button>
            <button type="button" className={tab === 'consent' ? 'on' : ''} onClick={() => setTab('consent')}>{t('consentLog')}</button>
          </div>
          {tab === 'rc' ? <RcLog /> : <ConsentLog />}
        </>
      )}
    </div>
  );
}
