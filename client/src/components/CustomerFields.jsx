import { useI18n } from '../i18n.jsx';
import { Field } from './ui.jsx';

export const emptyCustomer = (lang = 'mr') => ({ name: '', mobile: '', whatsapp: '', altMobile: '', city: '', language: lang, tags: [], referredBy: '', notes: '' });
const TAGS = ['fleet', 'walkin', 'reference'];

export default function CustomerFields({ value: c, onChange, compact }) {
  const { t } = useI18n();
  const set = (k) => (e) => onChange({ ...c, [k]: e.target.value });
  const toggleTag = (tag) => onChange({ ...c, tags: c.tags?.includes(tag) ? c.tags.filter((x) => x !== tag) : [...(c.tags || []), tag] });
  const same = !c.whatsapp || c.whatsapp === c.mobile;
  return (
    <>
      <Field label={t('customerName')}><input className="input" value={c.name} onChange={set('name')} required /></Field>
      <Field label={t('mobile')}>
        <input
          className="input" value={c.mobile} inputMode="numeric" maxLength={13}
          onChange={(e) => onChange({ ...c, mobile: e.target.value, whatsapp: same ? e.target.value : c.whatsapp })}
        />
      </Field>
      <Field label={t('whatsappNo')} hint={same ? t('sameAsMobile') : undefined}>
        <input className="input" value={c.whatsapp} inputMode="numeric" maxLength={13} onChange={set('whatsapp')} />
      </Field>
      <Field label={t('language')}>
        <div className="seg">
          {[['mr', 'मराठी'], ['hi', 'हिंदी'], ['en', 'English']].map(([k, l]) => (
            <button type="button" key={k} className={c.language === k ? 'on' : ''} onClick={() => onChange({ ...c, language: k })}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label={t('city')}><input className="input" value={c.city} onChange={set('city')} /></Field>
      {!compact && (
        <>
          <Field label={`${t('altNo')} (${t('optional')})`}><input className="input" value={c.altMobile} inputMode="numeric" onChange={set('altMobile')} /></Field>
          <Field label={t('tags')}>
            <div className="chips">
              {TAGS.map((x) => (
                <button type="button" key={x} className={`chip ${c.tags?.includes(x) ? 'on' : ''}`} onClick={() => toggleTag(x)}>{t(`tag_${x}`)}</button>
              ))}
            </div>
          </Field>
          {c.tags?.includes('reference') && <Field label={t('referredBy')}><input className="input" value={c.referredBy} onChange={set('referredBy')} /></Field>}
          <Field label={t('notes')}><textarea className="input" value={c.notes} onChange={set('notes')} /></Field>
        </>
      )}
    </>
  );
}
