import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorBox, Loading } from '../components/ui.jsx';
import { useApi, useDebounced } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { telLink, waLink } from '../util.js';

export function fleetSummary(t, v) {
  if (!v?.total) return '';
  const parts = Object.entries(v.byType).map(([k, n]) => `${n} ${t(`vt_${k}`)}`);
  return `${t('fleet', { n: v.total })} · ${parts.join(', ')}`;
}

export default function Customers() {
  const { t } = useI18n();
  const { canWrite } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, loading, error, reload } = useApi(`/customers?q=${encodeURIComponent(dq)}`, [dq]);

  return (
    <div className="stack">
      <div className="row">
        <h2 className="spacer" style={{ fontSize: '1.2rem' }}>{t('customers')}</h2>
        {canWrite && <Link to="/customers/new" className="btn sm primary"><Icon name="plus" size={18} /> {t('addCustomer')}</Link>}
      </div>
      <input className="input" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : (
        <div className="card flush">
          {data?.length === 0 ? <div className="empty">{q ? t('noResults') : t('noCustomers')}</div> : (
            <div className="list">
              {data?.map((c) => (
                <div className="list-item" key={c._id}>
                  <div className="avatar">{c.name.slice(0, 1).toUpperCase()}</div>
                  <Link to={`/customers/${c._id}`} className="main">
                    <div className="t">{c.name}</div>
                    <div className="s">{[c.mobile, c.city].filter(Boolean).join(' · ')}</div>
                    {c.vehicles.total > 0 && <div className="s" style={{ color: 'var(--orange-dark)' }}>{fleetSummary(t, c.vehicles)}</div>}
                  </Link>
                  {c.mobile && <a className="round-btn call" href={telLink(c.mobile)} aria-label={t('call')}><Icon name="phone" /></a>}
                  {(c.whatsapp || c.mobile) && (
                    <a className="round-btn wa" href={waLink(c.whatsapp || c.mobile)} target="_blank" rel="noreferrer" aria-label={t('whatsapp')}><Icon name="whatsapp" /></a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
