import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { useI18n } from '../i18n.jsx';

export default function AddMenu() {
  const { t } = useI18n();
  const { tenant } = useAuth();
  const puc = { to: '/puc', icon: 'gauge', c: 'o', title: t('pucEntry'), hint: `${t('certNo')} · ${t('cashToday')}` };
  const items = [
    { to: '/vehicles/new', icon: 'car', c: 'o', title: t('addVehicle'), hint: t('addVehicleHint') },
    { to: '/customers/new', icon: 'user', c: 'b', title: t('addCustomer'), hint: t('addCustomerHint') },
    { to: '/customers', icon: 'shield', c: 'b', title: t('addPolicy'), hint: t('addPolicyHint') },
    { to: '/bulk', icon: 'layers', c: 'b', title: t('bulkFetch'), hint: t('bulkHint') },
    { to: '/import', icon: 'upload', c: 'b', title: t('importData'), hint: '.xlsx / .csv' },
  ];
  if (tenant?.mode === 'puc_centre') items.unshift(puc);
  else items.push({ ...puc, c: 'b' });
  return (
    <div className="stack">
      <h2 style={{ fontSize: '1.2rem' }}>{t('addWhat')}</h2>
      {items.map((i) => (
        <Link key={i.to + i.title} to={i.to} className="card add-option">
          <span className={`ic ${i.c}`}><Icon name={i.icon} size={28} /></span>
          <span className="spacer">
            <div className="bold" style={{ fontSize: '1.05rem' }}>{i.title}</div>
            <div className="small muted">{i.hint}</div>
          </span>
          <Icon name="chevron" />
        </Link>
      ))}
    </div>
  );
}
