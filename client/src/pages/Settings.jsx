import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, Field, useToast } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { LANGS, useI18n } from '../i18n.jsx';
import { applyTheme, readTheme } from '../theme.js';

const SAMPLE = { name: 'Santosh Patil', vehicle: 'MH 08 AB 1234', expiry: '26-10-2026' };

function Templates() {
  const { t, lang } = useI18n();
  const { user, isOwner } = useAuth();
  const { data, reload } = useApi('/templates');
  const [tlang, setTlang] = useState(lang);
  const [kind, setKind] = useState('default');
  const [body, setBody] = useState('');
  const [, setToast, toast] = useToast();
  useEffect(() => {
    if (data) setBody(data.templates[kind]?.[tlang] || '');
  }, [data, kind, tlang]);
  if (!data) return null;
  const docLabel = { mr: 'विमा', hi: 'बीमा', en: 'Insurance' }[tlang];
  const preview = body.replace(/\{(\w+)\}/g, (m, k) => ({ ...SAMPLE, doc: docLabel, agent_name: user.name, agent_phone: user.mobile })[k] ?? m);
  const save = async () => {
    await api('/templates', { method: 'PUT', body: { docType: kind, language: tlang, body } });
    setToast(t('saved'));
    reload();
  };
  const reset = async () => {
    await api(`/templates?docType=${kind}&language=${tlang}`, { method: 'DELETE' });
    reload();
  };
  return (
    <details className="card">
      <summary>{t('templates')}</summary>
      <div className="stack" style={{ marginTop: 10 }}>
        <div className="seg">
          {LANGS.map((l) => <button type="button" key={l.code} className={tlang === l.code ? 'on' : ''} onClick={() => setTlang(l.code)}>{l.label}</button>)}
        </div>
        <div className="seg">
          <button type="button" className={kind === 'default' ? 'on' : ''} onClick={() => setKind('default')}>{t('beforeExpiry')}</button>
          <button type="button" className={kind === 'expired' ? 'on' : ''} onClick={() => setKind('expired')}>{t('afterExpiry')}</button>
        </div>
        <textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} disabled={!isOwner} />
        <div className="hint">{t('templateHelp')}</div>
        <div className="small bold">{t('preview')}</div>
        <div className="msg-preview">{preview}</div>
        {isOwner && (
          <div className="grid2">
            <button type="button" className="btn ghost" onClick={reset}>{t('resetDefault')}</button>
            <button type="button" className="btn primary" onClick={save}>{t('save')}</button>
          </div>
        )}
      </div>
      {toast}
    </details>
  );
}

function Team() {
  const { t } = useI18n();
  const { data, reload } = useApi('/users');
  const [f, setF] = useState({ name: '', mobile: '', password: '', role: 'staff', canViewAll: false });
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(null);
  if (!data) return null;
  const add = async (e) => {
    e.preventDefault();
    try {
      await api('/users', { method: 'POST', body: f });
      setF({ name: '', mobile: '', password: '', role: 'staff', canViewAll: false });
      setOpen(false);
      reload();
    } catch (ex) {
      setErr(ex);
    }
  };
  const toggle = async (u, patch) => {
    await api(`/users/${u.id}`, { method: 'PATCH', body: patch });
    reload();
  };
  return (
    <details className="card">
      <summary>{t('team')} ({data.length})</summary>
      <div className="list" style={{ marginTop: 6 }}>
        {data.map((u) => (
          <div key={u.id} className="list-item" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="avatar">{u.name[0]}</div>
            <div className="main">
              <div className="t">{u.name} {!u.active && <span className="pill archived">off</span>}</div>
              <div className="s">{u.mobile} · {t(`role_${u.role}`)}</div>
              {u.role === 'staff' && (
                <label className="row tiny" style={{ gap: 6, marginTop: 4 }}>
                  <input type="checkbox" checked={u.canViewAll} onChange={(e) => toggle(u, { canViewAll: e.target.checked })} /> {t('canViewAll')}
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
      {open ? (
        <form className="stack" onSubmit={add} style={{ marginTop: 10 }}>
          <Field label={t('name')}><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label={t('mobile')}><input className="input" inputMode="numeric" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} required /></Field>
          <Field label={t('password')}><input className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} minLength={6} required /></Field>
          <Field label={t('role')}>
            <div className="seg">
              {['staff', 'readonly', 'owner'].map((r) => <button type="button" key={r} className={f.role === r ? 'on' : ''} onClick={() => setF({ ...f, role: r })}>{t(`role_${r}`)}</button>)}
            </div>
          </Field>
          {f.role === 'staff' && (
            <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={f.canViewAll} onChange={(e) => setF({ ...f, canViewAll: e.target.checked })} /> {t('canViewAll')}</label>
          )}
          {err && <div className="banner err">{errorText(t, err)}</div>}
          <button className="btn primary block">{t('save')}</button>
        </form>
      ) : (
        <button type="button" className="btn block" style={{ marginTop: 10 }} onClick={() => setOpen(true)}><Icon name="plus" size={18} /> {t('addMember')}</button>
      )}
    </details>
  );
}

const PUC_RATE_KEYS = ['2W', 'car', 'auto', 'pickup', 'default'];

function Business() {
  const { t } = useI18n();
  const { tenant, setTenant } = useAuth();
  const [run, setRun] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState(null);
  const [, setToast, toast] = useToast();
  const st = tenant?.settings || {};
  const [rates, setRates] = useState(() => Object.fromEntries(PUC_RATE_KEYS.map((k) => [k, String(st.pucRates?.[k] ?? '')])));
  const [threshold, setThreshold] = useState(String(st.lowCreditThreshold ?? 10));

  const patch = async (body) => {
    setErr(null);
    try {
      setTenant(await api('/tenant', { method: 'PATCH', body }));
      setToast(t('saved'));
    } catch (ex) {
      setErr(ex);
    }
  };
  const runNow = async () => {
    setRunning(true);
    setErr(null);
    try {
      setRun(await api('/pipeline/renewal-check/run', { method: 'POST' }));
      api('/wallet').then((w) => setTenant({ ...tenant, rcCredits: w.balance })).catch(() => {});
    } catch (ex) {
      setErr(ex);
    } finally {
      setRunning(false);
    }
  };

  return (
    <details className="card" open>
      <summary>{t('business')}</summary>
      <div className="stack" style={{ marginTop: 10 }}>
        <Field label={t('businessMode')}>
          <div className="seg">
            {['agent', 'puc_centre'].map((m) => <button type="button" key={m} className={tenant?.mode === m ? 'on' : ''} onClick={() => patch({ mode: m })}>{t(`mode_${m}`)}</button>)}
          </div>
        </Field>
        <Link to="/wallet" className="row card" style={{ boxShadow: 'none', background: 'var(--bg)' }}>
          <Icon name="wallet" /><span className="spacer bold">{t('wallet')}</span><span className="bold">{tenant?.rcCredits}</span><Icon name="chevron" />
        </Link>
        <div className="grid2" style={{ alignItems: 'end' }}>
          <Field label={t('lowCreditAlertAt')}>
            <input className="input" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <button type="button" className="btn" onClick={() => patch({ settings: { lowCreditThreshold: Number(threshold) || 0 } })}>{t('save')}</button>
        </div>
        <label className="row" style={{ justifyContent: 'space-between', minHeight: 48 }}>
          <span className="bold">{t('renewalCheckSetting')}</span>
          <input type="checkbox" style={{ width: 26, height: 26, accentColor: 'var(--orange)' }} checked={Boolean(st.renewalCheck)}
            onChange={(e) => patch({ settings: { renewalCheck: e.target.checked } })} />
        </label>
        <div className="hint">{t('renewalCheckHelp')}</div>
        {st.renewalCheck && (
          <button type="button" className="btn block" disabled={running} onClick={runNow}>
            {running ? <span className="spinner dark" /> : <><Icon name="refresh" /> {t('runNow')}</>}
          </button>
        )}
        {run && <div className="banner ok small">{t('checkedN', { n: run.checked, e: run.renewedElsewhere, u: run.renewedUs })}{run.stoppedNoCredits ? ` · ${t('noCredits')}` : ''}</div>}
        <div className="small bold">{t('pucRates')}</div>
        <div className="grid3">
          {PUC_RATE_KEYS.map((k) => (
            <Field key={k} label={k === 'default' ? t('vt_other') : t(`vt_${k}`)}>
              <input className="input" inputMode="numeric" value={rates[k]} onChange={(e) => setRates({ ...rates, [k]: e.target.value.replace(/\D/g, '') })} />
            </Field>
          ))}
        </div>
        <button type="button" className="btn block" onClick={() => patch({ settings: { pucRates: Object.fromEntries(Object.entries(rates).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])) } })}>{t('save')}</button>
        {err && <div className="banner err">{errorText(t, err)}</div>}
      </div>
      {toast}
    </details>
  );
}

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { user, tenant, isOwner, logout } = useAuth();
  const [theme, setTheme] = useState(readTheme());
  const changeLang = (l) => {
    setLang(l);
    api('/auth/me', { method: 'PATCH', body: { language: l } }).catch(() => {});
  };
  return (
    <div className="stack">
      <h2 style={{ fontSize: '1.2rem' }}>{t('settings')}</h2>
      <div className="card stack">
        <div className="row">
          <div className="avatar">{user.name[0]}</div>
          <div className="spacer"><div className="bold">{user.name}</div><div className="small muted">{tenant?.name} · {t(`role_${user.role}`)}</div></div>
        </div>
        <Field label={t('appLanguage')}>
          <div className="seg">
            {LANGS.map((l) => <button type="button" key={l.code} className={lang === l.code ? 'on' : ''} onClick={() => changeLang(l.code)}>{l.label}</button>)}
          </div>
        </Field>
        <label className="row" style={{ justifyContent: 'space-between', minHeight: 48 }}>
          <span className="row bold" style={{ gap: 8 }}><Icon name="moon" /> {t('darkMode')}</span>
          <input
            type="checkbox" style={{ width: 26, height: 26, accentColor: 'var(--orange)' }} checked={theme === 'dark'}
            onChange={(e) => { const th = e.target.checked ? 'dark' : 'light'; setTheme(th); applyTheme(th); }}
          />
        </label>
      </div>
      {isOwner && <Business />}
      <Templates />
      {isOwner && <Team />}
      <button type="button" className="btn danger block" onClick={logout}>{t('logout')}</button>
    </div>
  );
}
