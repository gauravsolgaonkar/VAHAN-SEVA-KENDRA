import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorBox, ExpiryPill, Loading, Plate } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { telLink, waLink } from '../util.js';

const inr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const BUCKETS = ['expired', 'due7', 'due15', 'due30', 'active'];
const ORDER = ['insurance', 'puc', 'fitness', 'permit', 'road_tax', 'rc', 'green_tax', 'speed_governor', 'vltd', 'reflective_tape', 'fastag', 'health', 'life', 'driving_licence'];

export default function Dashboard() {
  const { t } = useI18n();
  const { user, tenant } = useAuth();
  const { data, loading, error, reload } = useApi('/dashboard');

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  const types = ORDER.filter((k) => data.byType[k]);
  const puc = data.mode === 'puc_centre';
  const actions = [
    { to: '/puc', icon: 'gauge', label: t('pucEntry') },
    { to: '/bulk', icon: 'layers', label: t('bulkFetch') },
    { to: '/due?view=pipeline', icon: 'funnel', label: t('pipeline') },
    { to: '/import', icon: 'upload', label: t('import') },
  ];
  if (!puc) actions.push(actions.shift()); // agents use PUC entry least
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
        <Link to="/wallet" className="credit"><div className="k">{data.rc.credits}</div><div className="l">{t('rcCredits')}</div></Link>
        <div><div className="k">{data.rc.fetchesThisMonth}</div><div className="l">{t('rcFetchesMonth')}</div></div>
      </div>

      {data.rc.low && (
        <Link to="/wallet" className={`banner ${data.rc.credits === 0 ? 'err' : 'warn'} row`}>
          <Icon name="alert" /><span className="spacer">{data.rc.credits === 0 ? t('noCredits') : t('lowCredits', { n: data.rc.credits })}</span>
          <span className="btn sm primary">{t('buyCredits')}</span>
        </Link>
      )}

      <div className="qa">
        {actions.map((a) => (
          <Link key={a.to} to={a.to}><span className="ic-box b"><Icon name={a.icon} /></span>{a.label}</Link>
        ))}
      </div>

      {data.puc && (
        <Link to="/puc" className="card" style={{ padding: 0, display: 'block' }}>
          <div className="row" style={{ padding: '10px 12px 0' }}><span className="bold spacer">{t('pucToday')}</span><Icon name="chevron" /></div>
          <div className="grid3" style={{ gap: 0 }}>
            <div className="stat center"><div className="k">{data.puc.count}</div><div className="l">{t('pucToday')}</div></div>
            <div className="stat center"><div className="k" style={{ color: 'var(--green)' }}>{inr(data.puc.cash)}</div><div className="l">{t('cashToday')}</div></div>
            <div className="stat center"><div className="k">{inr(data.puc.total)}</div><div className="l">{t('totalToday')}</div></div>
          </div>
        </Link>
      )}

      {!puc && (
        <Link to="/reports" className="card" style={{ padding: 0, display: 'block' }}>
          <div className="grid2" style={{ gap: 0 }}>
            <div className="stat"><div className="k">{inr(data.month.premium)}</div><div className="l">{t('premiumMonth')}</div></div>
            <div className="stat"><div className="k" style={{ color: 'var(--green)' }}>{inr(data.month.commission)}</div><div className="l">{t('commissionMonth')}</div></div>
          </div>
          <div className="row small" style={{ borderTop: '1px solid var(--line)', padding: '8px 12px' }}>
            <span className="spacer muted bold">{t('wonLostMonth')}</span>
            <span className="pill cs-renewed">{t('renewed')} {data.month.renewed}</span>
            <span className="pill cs-lost">{t('lost')} {data.month.lost}</span>
          </div>
        </Link>
      )}

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
