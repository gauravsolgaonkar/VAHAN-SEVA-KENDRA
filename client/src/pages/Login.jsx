import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errorText, Field } from '../components/ui.jsx';
import { LANGS, useI18n } from '../i18n.jsx';

export default function Login({ mode }) {
  const { t, lang, setLang } = useI18n();
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ businessName: '', name: '', mobile: '', password: '', city: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isReg = mode === 'register';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (isReg) await register({ ...f, language: lang });
      else await login(f.mobile, f.password);
      nav('/', { replace: true });
    } catch (ex) {
      setErr(ex);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <div className="lang-switch">
          {LANGS.map((l) => (
            <button type="button" key={l.code} className={lang === l.code ? 'on' : ''} onClick={() => setLang(l.code)}>{l.label}</button>
          ))}
        </div>
      </div>
      <div className="logo">
        <img src="/icons/icon.svg" alt="" />
        <h1 style={{ fontSize: '1.6rem' }}>{t('appName')}</h1>
        <div style={{ opacity: 0.85 }}>{t('tagline')}</div>
      </div>
      <form className="card stack" onSubmit={submit} style={{ maxWidth: 440, width: '100%', margin: '0 auto' }}>
        {isReg && (
          <>
            <Field label={t('businessName')}><input className="input" value={f.businessName} onChange={set('businessName')} required /></Field>
            <Field label={t('yourName')}><input className="input" value={f.name} onChange={set('name')} required autoComplete="name" /></Field>
            <Field label={t('city')}><input className="input" value={f.city} onChange={set('city')} /></Field>
          </>
        )}
        <Field label={t('mobile')}>
          <input className="input" value={f.mobile} onChange={set('mobile')} inputMode="numeric" autoComplete="tel" maxLength={13} required />
        </Field>
        <Field label={t('password')}>
          <input className="input" type="password" value={f.password} onChange={set('password')} minLength={6} required autoComplete={isReg ? 'new-password' : 'current-password'} />
        </Field>
        {err && <div className="banner err">{errorText(t, err)}</div>}
        <button className="btn primary lg block" disabled={busy}>{busy ? <span className="spinner" /> : isReg ? t('register') : t('login')}</button>
        {isReg && <div className="hint center">{t('trialNote')}</div>}
      </form>
      <div className="center" style={{ marginTop: 18 }}>
        {isReg ? <Link to="/login">{t('haveAccount')}</Link> : <Link to="/register">{t('noAccount')}</Link>}
      </div>
    </div>
  );
}
