import { lazy, Suspense } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Icon from './components/Icon.jsx';
import { Loading } from './components/ui.jsx';
import { useOnline } from './hooks.js';
import { LANGS, useI18n } from './i18n.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';

// Less-used screens load on demand to keep the first load small on slow phones.
const DueList = lazy(() => import('./pages/DueList.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail.jsx'));
const CustomerForm = lazy(() => import('./pages/CustomerForm.jsx'));
const AddMenu = lazy(() => import('./pages/AddMenu.jsx'));
const AddVehicle = lazy(() => import('./pages/AddVehicle.jsx'));
const VehicleDetail = lazy(() => import('./pages/VehicleDetail.jsx'));
const DocumentForm = lazy(() => import('./pages/DocumentForm.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Search = lazy(() => import('./pages/Search.jsx'));

function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label="language">
      {LANGS.map((l) => (
        <button type="button" key={l.code} className={lang === l.code ? 'on' : ''} onClick={() => setLang(l.code)}>
          {l.code === 'en' ? 'EN' : l.label}
        </button>
      ))}
    </div>
  );
}

function TopBar() {
  const { t } = useI18n();
  const nav = useNavigate();
  return (
    <header className="topbar">
      <div className="brand title">
        <img src="/icons/icon.svg" alt="" />
        <span>{t('appName')}</span>
      </div>
      <LangSwitch />
      <button type="button" className="icon-btn" aria-label={t('search')} onClick={() => nav('/search')}><Icon name="search" /></button>
      <button type="button" className="icon-btn" aria-label={t('settings')} onClick={() => nav('/settings')}><Icon name="settings" /></button>
    </header>
  );
}

function BottomNav() {
  const { t } = useI18n();
  const items = [
    { to: '/', icon: 'home', label: t('nav_dashboard'), end: true },
    { to: '/due', icon: 'list', label: t('nav_due') },
    { to: '/add', icon: 'plus', label: t('nav_add'), add: true },
    { to: '/customers', icon: 'users', label: t('nav_customers') },
    { to: '/reports', icon: 'chart', label: t('nav_reports') },
  ];
  return (
    <nav className="bottomnav">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `${isActive ? 'active' : ''} ${i.add ? 'add' : ''}`}>
          {i.add ? <span className="add-fab"><Icon name="plus" size={28} stroke={2.6} /></span> : <Icon name={i.icon} />}
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const online = useOnline();
  const { t } = useI18n();
  const loc = useLocation();

  if (loading) return <Loading />;
  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<Login mode="register" />} />
        <Route path="*" element={<Login mode="login" />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <TopBar />
      {!online && <div className="offline-bar">{t('error_offline')}</div>}
      <main className="page" key={loc.pathname}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/due" element={<DueList />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />
            <Route path="/add" element={<AddMenu />} />
            <Route path="/vehicles/new" element={<AddVehicle />} />
            <Route path="/vehicles/:id" element={<VehicleDetail />} />
            <Route path="/documents/new" element={<DocumentForm />} />
            <Route path="/documents/:id" element={<DocumentForm />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/search" element={<Search />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
