import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorBox, ExpiryPill, Loading, Plate } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { telLink, waLink } from '../util.js';

const BUCKETS = ['expired', 'due7', 'due15', 'due30', 'active'];
const ORDER = ['insurance', 'puc', 'fitness', 'permit', 'road_tax', 'rc', 'green_tax', 'speed_governor', 'vltd', 'reflective_tape', 'fastag', 'health', 'life', 'driving_licence'];

export default function Dashboard() {
  const { t } = useI18n();
  const { user, tenant } = useAuth();
  const { data, loading, error, reload } = useApi('/dashboard');

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  const types = ORDER.filter((k) => data.byType[k]);
  return (
    <div className="stack">
      <div>
        <div className="app-name">{t('appName')}</div>
        <div className="muted small">{tenant?.name}</div>
        <h1 style={{ fontSize: '1.35rem' }}>{t('greeting')}, {user.name.split(' ')[0]} 🙏</h1>
      </div>

      <div className="hero">
        <Link to="/customers"><div className="k">{data.totals.customers}</div><div className="l">{t('customers')}</div></Link>
        <Link to="/customers"><div className="k">{data.totals.vehicles}</div><div className="l">{t('vehicles')}</div></Link>
        <Link to="/due"><div className="k">{data.totals.pendingReminders}</div><div className="l">{t('remindersPending')}</div></Link>
        <div className="credit"><div className="k">{data.rc.credits}</div><div className="l">{t('rcCredits')}</div></div>
        <div><div className="k">{data.rc.fetchesThisMonth}</div><div className="l">{t('rcFetchesMonth')}</div></div>
      </div>

      <div className="section-title"><h2>{t('docStatus')}</h2></div>
      <div className="card flush">
        {types.length === 0 ? (
          <div className="empty small">{t('noCustomers')}</div>
        ) : (
          <table className="status-table">
            <thead>
              <tr><th />{BUCKETS.map((b) => <th key={b}>{t(b)}</th>)}</tr>
            </thead>
            <tbody>
              {types.map((k) => (
                <tr key={k}>
                  <td>{t(`doc_${k}`)}</td>
                  {BUCKETS.map((b) => {
                    const n = data.byType[k][b];
                    return <td key={b} className={`c-${b} ${n ? '' : 'n0'}`}>{n || '·'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-title">
        <h2>{t('todaysCalls')}</h2>
        <Link to="/due" className="small bold" style={{ color: 'var(--orange-dark)' }}>{t('dueList')} →</Link>
      </div>
      <div className="card flush">
        {data.callList.length === 0 ? (
          <div className="empty">{t('noCalls')}</div>
        ) : (
          <div className="list">
            {data.callList.map((c) => (
              <div className="list-item" key={c.documentId}>
                <Link to={`/vehicles/${c.vehicle?._id}`} className="main">
                  <div className="t">{c.customer?.name}</div>
                  <div className="row wrap" style={{ marginTop: 4, gap: 6 }}>
                    <Plate regNo={c.vehicle?.regNo || ''} />
                    <span className="small bold">{t(`doc_${c.type}`)}</span>
                  </div>
                  <div style={{ marginTop: 4 }}><ExpiryPill date={c.expiryDate} /></div>
                </Link>
                {c.customer?.mobile && (
                  <a className="round-btn call" href={telLink(c.customer.mobile)} aria-label={t('call')}><Icon name="phone" /></a>
                )}
                {(c.customer?.whatsapp || c.customer?.mobile) && (
                  <a className="round-btn wa" href={waLink(c.customer.whatsapp || c.customer.mobile)} target="_blank" rel="noreferrer" aria-label={t('whatsapp')}>
                    <Icon name="whatsapp" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
