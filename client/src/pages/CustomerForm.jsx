import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { errorText, PageHeader } from '../components/ui.jsx';
import { useI18n } from '../i18n.jsx';
import CustomerFields, { emptyCustomer } from '../components/CustomerFields.jsx';

export default function CustomerForm() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [c, setC] = useState(emptyCustomer(lang));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (id) api(`/customers/${id}`).then((d) => setC({ ...emptyCustomer(lang), ...d })).catch(setErr);
  }, [id, lang]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = id ? await api(`/customers/${id}`, { method: 'PATCH', body: c }) : await api('/customers', { method: 'POST', body: c });
      nav(`/customers/${saved._id}`, { replace: true });
    } catch (ex) {
      setErr(ex);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <PageHeader title={id ? c.name : t('addCustomer')} />
      <div className="card stack"><CustomerFields value={c} onChange={setC} /></div>
      {err && <div className="banner err">{errorText(t, err)}</div>}
      <button className="btn primary lg block" disabled={busy}>{t('save')}</button>
    </form>
  );
}
