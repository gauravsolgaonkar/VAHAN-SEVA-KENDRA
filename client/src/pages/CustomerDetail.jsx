import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorBox, ExpiryPill, Loading, PageHeader, Plate } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { telLink, waLink } from '../util.js';

export default function CustomerDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const { canWrite } = useAuth();
  const { data: c, loading, error, reload } = useApi(`/customers/${id}`, [id]);
  if (loading && !c) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="stack">
      <PageHeader title={c.name} right={canWrite && <Link to={`/customers/${id}/edit`} className="btn sm ghost">{t('edit')}</Link>} />
      <div className="card stack" style={{ gap: 10 }}>
        <div className="kv">
          <span className="k">{t('mobile')}</span><span className="v">{c.mobile || '—'}</span>
          <span className="k">{t('whatsappNo')}</span><span className="v">{c.whatsapp || '—'}</span>
          {c.altMobile && <><span className="k">{t('altNo')}</span><span className="v">{c.altMobile}</span></>}
          <span className="k">{t('city')}</span><span className="v">{c.city || '—'}</span>
          <span className="k">{t('language')}</span><span className="v">{{ mr: 'मराठी', hi: 'हिंदी', en: 'English' }[c.language]}</span>
          {c.tags?.length > 0 && <><span className="k">{t('tags')}</span><span className="v">{c.tags.map((x) => t(`tag_${x}`)).join(', ')}</span></>}
          {c.referredBy && <><span className="k">{t('referredBy')}</span><span className="v">{c.referredBy}</span></>}
        </div>
        {c.notes && <div className="small muted">{c.notes}</div>}
        <div className="grid2">
          {c.mobile && <a className="btn blue" href={telLink(c.mobile)}><Icon name="phone" /> {t('call')}</a>}
          {(c.whatsapp || c.mobile) && <a className="btn wa" href={waLink(c.whatsapp || c.mobile)} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> {t('whatsapp')}</a>}
        </div>
      </div>

      <div className="section-title">
        <h2>{t('vehicles')} ({c.vehicles.length})</h2>
        {canWrite && <Link to={`/vehicles/new?customerId=${id}`} className="btn sm primary"><Icon name="plus" size={18} /> {t('addVehicle')}</Link>}
      </div>
      {c.vehicles.map((v) => {
        const next = v.documents.filter((d) => d.expiryDate).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        return (
          <Link to={`/vehicles/${v._id}`} key={v._id} className="card stack" style={{ gap: 8 }}>
            <div className="row">
              <Plate regNo={v.regNo} />
              <span className="small muted spacer">{t(`vt_${v.vehicleType}`)} · {[v.maker?.split(' ')[0], v.model].filter(Boolean).join(' ')}</span>
              {v.blacklisted && <span className="pill expired">{t('blacklisted')}</span>}
              <Icon name="chevron" size={18} />
            </div>
            <div className="chips">
              {next.slice(0, 5).map((d) => (
                <span key={d._id} className="row" style={{ gap: 4 }}>
                  <span className="tiny bold">{t(`doc_${d.type}`)}</span> <ExpiryPill date={d.expiryDate} />
                </span>
              ))}
            </div>
          </Link>
        );
      })}

      <div className="section-title">
        <h2>{t('personalPolicies')}</h2>
        {canWrite && <Link to={`/documents/new?customerId=${id}&type=health`} className="btn sm"><Icon name="plus" size={18} /> {t('addPolicy')}</Link>}
      </div>
      <div className="card flush">
        {c.personalDocuments.length === 0 ? <div className="empty small">—</div> : (
          <div className="list">
            {c.personalDocuments.map((d) => (
              <Link to={`/documents/${d._id}`} className="list-item" key={d._id}>
                <div className="main">
                  <div className="t">{t(`doc_${d.type}`)}</div>
                  <div className="s">{[d.provider, d.number].filter(Boolean).join(' · ')}</div>
                </div>
                <ExpiryPill date={d.expiryDate} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
