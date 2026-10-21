import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { daysUntil, displayRegNo, fmtDate, statusOf } from '../util.js';
import Icon from './Icon.jsx';

export function Loading() {
  const { t } = useI18n();
  return (
    <div className="empty">
      <span className="spinner dark" /> <div className="small">{t('loading')}</div>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  const { t } = useI18n();
  if (!error) return null;
  const key = `error_${error.code}`;
  const msg = t(key) === key ? t('error_generic') : t(key);
  return (
    <div className="banner err row">
      <span className="spacer">{msg}</span>
      {onRetry && <button type="button" className="btn sm danger" onClick={onRetry}>{t('retry')}</button>}
    </div>
  );
}

export function errorText(t, error) {
  if (!error) return '';
  const key = `error_${error.code}`;
  return t(key) === key ? t('error_generic') : t(key);
}

export function Plate({ regNo, lg }) {
  return <span className={`plate${lg ? ' lg' : ''}`}>{displayRegNo(regNo)}</span>;
}

/** Status pill: "5 days left" / "Expired 3 days ago" coloured by urgency. */
export function ExpiryPill({ date, archived }) {
  const { t } = useI18n();
  if (archived) return <span className="pill archived">{t('archived')}</span>;
  const d = daysUntil(date);
  if (d === null) return <span className="pill none">—</span>;
  const s = statusOf(d);
  const label = d < 0 ? t('expiredAgo', { n: -d }) : d === 0 ? t('dueToday') : d <= 30 ? t('daysLeft', { n: d }) : fmtDate(date);
  return <span className={`pill ${s}`}>{label}</span>;
}

export function Field({ label, hint, error, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="hint err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function PageHeader({ title, back = true, right }) {
  const nav = useNavigate();
  return (
    <div className="row" style={{ marginBottom: 4 }}>
      {back && (
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label="back" style={{ marginLeft: -8 }}>
          <Icon name="back" />
        </button>
      )}
      <h2 className="spacer" style={{ fontSize: '1.2rem' }}>{title}</h2>
      {right}
    </div>
  );
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const tm = setTimeout(onDone, 2600);
    return () => clearTimeout(tm);
  }, [message, onDone]);
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

export function useToast() {
  const [msg, setMsg] = useState('');
  return [msg, setMsg, <Toast key="toast" message={msg} onDone={() => setMsg('')} />];
}
