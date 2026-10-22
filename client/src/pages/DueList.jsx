import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorBox, ExpiryPill, Loading, Plate, useToast } from '../components/ui.jsx';
import { useApi } from '../hooks.js';
import { useI18n } from '../i18n.jsx';
import { telLink } from '../util.js';
import { CaseChip, PipelineList } from './Pipeline.jsx';

function ReminderCard({ r, onDone, showMessage, canWrite }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const act = async (kind) => {
    setBusy(true);
    try {
      await api(`/reminders/${r._id}/${kind}`, { method: 'POST' });
      onDone(r._id, kind);
    } finally {
      setBusy(false);
    }
  };
  const openWa = () => {
    window.open(r.waLink, '_blank', 'noopener');
  };
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row">
        <Link to={`/customers/${r.customer?._id}`} className="spacer" style={{ minWidth: 0 }}>
          <div className="bold">{r.customer?.name}</div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {r.vehicle && <Plate regNo={r.vehicle.regNo} />}
            <span className="small bold">{t(`doc_${r.document.type}`)}</span>
          </div>
        </Link>
        <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
          <ExpiryPill date={r.document.expiryDate} />
          {r.case && <CaseChip status={r.case.status} id={r.case._id} />}
        </div>
      </div>
      {showMessage && <div className="msg-preview">{r.message}</div>}
      <div className="row">
        {r.customer?.mobile && (
          <a className="round-btn call" href={telLink(r.customer.mobile)} aria-label={t('call')}><Icon name="phone" /></a>
        )}
        {r.waLink ? (
          <button type="button" className="btn wa spacer" onClick={openWa}><Icon name="whatsapp" /> {t('whatsapp')}</button>
        ) : (
          <span className="spacer hint">{t('noWhatsapp')}</span>
        )}
        {canWrite && (
          <>
            <button type="button" className="btn sm" disabled={busy} onClick={() => act('sent')}><Icon name="check" size={18} /> {t('markSent')}</button>
            <button type="button" className="btn sm ghost" disabled={busy} onClick={() => act('skip')} aria-label={t('skip')}><Icon name="x" size={18} /></button>
          </>
        )}
      </div>
    </div>
  );
}

/** Bulk mode: one reminder at a time, big buttons. Open WhatsApp, come back, tap Sent & next. */
function BulkMode({ items, onExit, onDone }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [opened, setOpened] = useState(false);
  const r = items[i];
  if (!r) {
    return (
      <div className="card stack center">
        <div style={{ fontSize: 40 }}>🎉</div>
        <h2>{t('bulkDone')}</h2>
        <button type="button" className="btn blue block" onClick={onExit}>{t('back')}</button>
      </div>
    );
  }
  const advance = async (kind) => {
    await api(`/reminders/${r._id}/${kind}`, { method: 'POST' }).catch(() => {});
    onDone(r._id, kind, true);
    setOpened(false);
    setI(i + 1);
  };
  return (
    <div className="stack">
      <div className="row">
        <span className="bold spacer">{t('bulkProgress', { i: i + 1, n: items.length })}</span>
        <button type="button" className="btn sm ghost" onClick={onExit}><Icon name="x" size={18} /></button>
      </div>
      <div className="progress"><div style={{ width: `${(i / items.length) * 100}%` }} /></div>
      <div className="card stack">
        <div className="row">
          <div className="spacer">
            <div className="bold" style={{ fontSize: '1.1rem' }}>{r.customer?.name}</div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              {r.vehicle && <Plate regNo={r.vehicle.regNo} />}
              <span className="small bold">{t(`doc_${r.document.type}`)}</span>
            </div>
          </div>
          <ExpiryPill date={r.document.expiryDate} />
        </div>
        <div className="msg-preview">{r.message}</div>
        {r.waLink ? (
          <a className="btn wa lg block" href={r.waLink} target="_blank" rel="noreferrer" onClick={() => setOpened(true)}>
            <Icon name="whatsapp" /> {t('openWhatsapp')}
          </a>
        ) : (
          <div className="banner warn">{t('noWhatsapp')}</div>
        )}
        <div className="grid2">
          <button type="button" className="btn ghost lg" onClick={() => advance('skip')}>{t('skip')}</button>
          <button type="button" className={`btn lg ${opened ? 'primary' : 'blue'}`} onClick={() => advance('sent')}>{t('markSent')} → </button>
        </div>
      </div>
    </div>
  );
}

export default function DueList() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'pipeline' ? 'pipeline' : 'reminders';
  const viewSeg = (
    <div className="seg">
      <button type="button" className={view === 'reminders' ? 'on' : ''} onClick={() => setParams({})}>{t('reminders')}</button>
      <button type="button" className={view === 'pipeline' ? 'on' : ''} onClick={() => setParams({ view: 'pipeline' })}>{t('pipeline')}</button>
    </div>
  );
  if (view === 'pipeline') {
    return (
      <div className="stack">
        <h2 style={{ fontSize: '1.2rem' }}>{t('dueList')}</h2>
        {viewSeg}
        <PipelineList />
      </div>
    );
  }
  return <Reminders viewSeg={viewSeg} />;
}

function Reminders({ viewSeg }) {
  const { t } = useI18n();
  const { canWrite } = useAuth();
  const [tab, setTab] = useState('pending');
  const [bulk, setBulk] = useState(false);
  const [showMsg, setShowMsg] = useState(false);
  const { data, loading, error, reload, setData } = useApi(`/reminders?status=${tab}`, [tab]);
  const [, setToast, toast] = useToast();

  const onDone = (id, kind, silent) => {
    if (!silent) setData(data.filter((r) => r._id !== id));
    if (!silent && kind === 'sent') setToast(t('sent'));
  };

  if (bulk && data) {
    return <BulkMode items={data} onExit={() => { setBulk(false); reload(); }} onDone={onDone} />;
  }

  return (
    <div className="stack">
      <div className="row">
        <h2 className="spacer" style={{ fontSize: '1.2rem' }}>{t('dueList')}</h2>
      </div>
      {viewSeg}
      <div className="chips">
        <button type="button" className={`chip ${tab === 'pending' ? 'on' : ''}`} onClick={() => setTab('pending')}>{t('pending')}</button>
        <button type="button" className={`chip ${tab === 'sent' ? 'on' : ''}`} onClick={() => setTab('sent')}>{t('sent')}</button>
      </div>
      {tab === 'pending' && data?.length > 0 && canWrite && (
        <button type="button" className="btn primary lg block" onClick={() => setBulk(true)}>
          <Icon name="whatsapp" /> {t('bulkMode')} ({data.length})
        </button>
      )}
      {data?.length > 0 && (
        <label className="row small muted" style={{ gap: 8 }}>
          <input type="checkbox" checked={showMsg} onChange={(e) => setShowMsg(e.target.checked)} /> {t('preview')}
        </label>
      )}
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : data?.length === 0 ? (
        <div className="card empty">{t('queueEmpty')}</div>
      ) : (
        data?.map((r) => <ReminderCard key={r._id} r={r} onDone={onDone} showMessage={showMsg || tab === 'sent'} canWrite={canWrite && tab === 'pending'} />)
      )}
      {toast}
    </div>
  );
}
