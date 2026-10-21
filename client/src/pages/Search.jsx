import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading, Plate } from '../components/ui.jsx';
import { useApi, useDebounced } from '../hooks.js';
import { useI18n } from '../i18n.jsx';

export default function Search() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim());
  const { data, loading } = useApi(dq.length >= 2 ? `/search?q=${encodeURIComponent(dq)}` : null, [dq]);
  const none = data && !data.customers.length && !data.vehicles.length && !data.documents.length;
  return (
    <div className="stack">
      <input className="input" autoFocus type="search" placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
      {dq.length >= 2 && loading && <Loading />}
      {dq.length >= 2 && none && <div className="empty">{t('noResults')}</div>}
      {data?.vehicles.length > 0 && (
        <div className="card flush"><div className="list">
          {data.vehicles.map((v) => (
            <Link key={v._id} to={`/vehicles/${v._id}`} className="list-item">
              <Plate regNo={v.regNo} /><div className="main"><div className="s">{v.customerId?.name} · {v.maker} {v.model}</div></div>
            </Link>
          ))}
        </div></div>
      )}
      {data?.customers.length > 0 && (
        <div className="card flush"><div className="list">
          {data.customers.map((c) => (
            <Link key={c._id} to={`/customers/${c._id}`} className="list-item">
              <div className="avatar">{c.name[0]}</div><div className="main"><div className="t">{c.name}</div><div className="s">{c.mobile}</div></div>
            </Link>
          ))}
        </div></div>
      )}
      {data?.documents.length > 0 && (
        <div className="card flush"><div className="list">
          {data.documents.map((d) => (
            <Link key={d._id} to={`/documents/${d._id}`} className="list-item">
              <div className="main"><div className="t">{t(`doc_${d.type}`)} · {d.number}</div><div className="s">{d.customerId?.name} {d.vehicleId?.regNo ? `· ${d.vehicleId.regNo}` : ''}</div></div>
            </Link>
          ))}
        </div></div>
      )}
    </div>
  );
}
