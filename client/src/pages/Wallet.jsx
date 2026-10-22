import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { errorText, ErrorBox, Loading, PageHeader, useToast } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { displayRegNo, fmtDate } from '../util.js';

const rupees = (paise) => (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Razorpay Checkout is loaded only when someone actually pays. */
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(Object.assign(new Error('offline'), { code: 'offline' }));
    document.body.appendChild(s);
  });
}

export default function Wallet() {
  const { t } = useI18n();
  const { isOwner, tenant, setTenant } = useAuth();
  const { data, loading, error, reload } = useApi('/wallet');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [toast, setToast, toastEl] = useToast();

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  const done = (balance, credits) => {
    setTenant({ ...tenant, rcCredits: balance });
    setToast(t('paymentDone', { n: credits }));
    reload();
  };

  const buy = async (pack) => {
    setErr(null);
    setBusy(pack.id);
    try {
      const order = await api('/wallet/orders', { method: 'POST', body: { packId: pack.id } });
      if (order.mock) {
        if (!window.confirm(t('confirmMockPay', { a: rupees(order.amountPaise) }))) return;
        const v = await api('/wallet/verify', { method: 'POST', body: { orderId: order.orderId } });
        done(v.balance, order.credits);
        return;
      }
      await loadCheckout();
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: 'INR',
          name: 'Vahan Seva Kendra',
          description: `${order.credits} RC ${t('credits')}`,
          prefill: order.prefill,
          theme: { color: '#0b2a6f' },
          handler: async (resp) => {
            try {
              const v = await api('/wallet/verify', {
                method: 'POST',
                body: { orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature },
              });
              done(v.balance, order.credits);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          modal: { ondismiss: resolve },
        });
        rzp.open();
      });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  };

  const low = data.balance <= data.lowThreshold;
  return (
    <div className="stack">
      <PageHeader title={t('wallet')} />
      <div className="card center" style={{ padding: '22px 16px' }}>
        <div className="tiny muted">{t('balance')}</div>
        <div className="bold" style={{ fontSize: '2.6rem', color: low ? 'var(--red)' : 'var(--blue)', lineHeight: 1.1 }}>{data.balance}</div>
        <div className="small muted">{t('credits')} · {t('perCredit', { p: rupees(data.pricePerCreditPaise) })}</div>
      </div>
      {data.balance === 0 ? <div className="banner err">{t('noCredits')}</div> : low && <div className="banner warn">{t('lowCredits', { n: data.balance })}</div>}

      <div className="section-title"><h2>{t('buyCredits')}</h2></div>
      {data.payments === 'off' && <div className="banner info">{t('paymentsOff')}</div>}
      {data.payments === 'mock' && <div className="banner info">{t('mockPayment')}</div>}
      {!isOwner && <div className="banner info">{t('ownerOnly')}</div>}
      {err && <div className="banner err">{errorText(t, err)}</div>}
      <div className="stack" style={{ gap: 10 }}>
        {data.packs.map((p) => (
          <div key={p.id} className="card row">
            <span className="ic-box"><Icon name="wallet" /></span>
            <span className="spacer">
              <div className="bold" style={{ fontSize: '1.1rem' }}>{p.credits} {t('credits')}</div>
              <div className="small muted">
                ₹{rupees(p.pricePaise)}
                {p.discountPct > 0 && <span className="pill active" style={{ marginLeft: 6 }}>{t('save_pct', { n: p.discountPct })}</span>}
              </div>
            </span>
            <button type="button" className="btn primary" disabled={!isOwner || data.payments === 'off' || busy !== null} onClick={() => buy(p)}>
              {busy === p.id ? <span className="spinner" /> : `${t('pay')} ₹${rupees(p.pricePaise)}`}
            </button>
          </div>
        ))}
      </div>

      <div className="section-title"><h2>{t('ledger')}</h2></div>
      <div className="card flush">
        <div className="list">
          {data.txns.length === 0 && <div className="empty small">{t('noCases')}</div>}
          {data.txns.map((x) => (
            <div className="list-item" key={x._id}>
              <div className="main">
                <div className="t">{t(`txn_${x.type}`)}{x.regNo ? <span className="mono"> · {displayRegNo(x.regNo)}</span> : null}</div>
                <div className="s">{fmtDate(x.createdAt)} {new Date(x.createdAt).toTimeString().slice(0, 5)}{x.userId?.name ? ` · ${x.userId.name}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="bold" style={{ color: x.credits < 0 ? 'var(--red)' : 'var(--green)' }}>{x.credits > 0 ? '+' : ''}{x.credits}</div>
                <div className="tiny muted">{x.balanceAfter}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {toastEl}
    </div>
  );
}
