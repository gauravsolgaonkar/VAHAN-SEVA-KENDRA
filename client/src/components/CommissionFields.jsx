import { useI18n } from '../i18n.jsx';
import { Field } from './ui.jsx';

export const COMMISSION_TYPES = ['pct_od', 'pct_tp', 'pct_total', 'flat'];
const PLATFORMS = ['Turtlemint', 'PB Partner', 'RenewBuy', 'InsuranceDekho', 'Direct insurer'];

/** Mirror of server computeCommission() so the agent sees the amount while typing. */
export function previewCommission(c = {}, ins = {}) {
  const rate = Number(c.rate) || 0;
  if (!c.type || !rate) return 0;
  if (c.type === 'flat') return Math.round(rate);
  const base = c.type === 'pct_od' ? ins.odPremium : c.type === 'pct_tp' ? ins.tpPremium : ins.totalPremium;
  return Math.round(((Number(base) || 0) * rate) / 100);
}

/** Commission type / rate / platform / payout. `value` is the commission object, `insurance` gives the premium base. */
export default function CommissionFields({ value = {}, insurance = {}, onChange }) {
  const { t } = useI18n();
  const set = (k, v) => onChange({ ...value, [k]: v });
  const amount = previewCommission(value, insurance);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Field label={t('commissionType')}>
        <div className="chips">
          {COMMISSION_TYPES.map((k) => (
            <button type="button" key={k} className={`chip ${value.type === k ? 'on' : ''}`} onClick={() => set('type', value.type === k ? null : k)}>{t(`ct_${k}`)}</button>
          ))}
        </div>
      </Field>
      {value.type && (
        <div className="grid2">
          <Field label={value.type === 'flat' ? t('rateFlat') : t('ratePct')}>
            <input className="input" inputMode="decimal" value={value.rate ?? ''} onChange={(e) => set('rate', e.target.value.replace(/[^\d.]/g, ''))} />
          </Field>
          <Field label={t('commission')}>
            <div className="input" style={{ display: 'flex', alignItems: 'center', fontWeight: 800, color: 'var(--green)' }}>₹{amount.toLocaleString('en-IN')}</div>
          </Field>
        </div>
      )}
      <Field label={t('platform')} hint={t('platformHint')}>
        <input className="input" list="vsk-platforms" value={value.platform || ''} onChange={(e) => set('platform', e.target.value)} />
        <datalist id="vsk-platforms">{PLATFORMS.map((p) => <option key={p} value={p} />)}</datalist>
      </Field>
      <label className={`check ${value.payoutReceived ? 'on' : ''}`}>
        <input type="checkbox" checked={Boolean(value.payoutReceived)} onChange={(e) => set('payoutReceived', e.target.checked)} />
        <span className="small bold">{t('payoutReceived')}</span>
      </label>
    </div>
  );
}
