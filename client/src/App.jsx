import { useState } from 'react';
import {
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';
import {
  Compass,
  CalendarDays,
  Ticket,
  LayoutDashboard,
  Plus,
  Users,
  Building2,
  Layers3,
  KeyRound,
  ArrowUpRight,
  ChevronsUpDown,
  LogOut,
  Menu,
  X,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Leaf,
  Link2
} from 'lucide-react';
import { AppProvider, useApp, useResource } from './context/AppContext';
import { Loading, IconButton, ErrorMessage } from './components/UI';
import Discover from './pages/Discover';
import { EventDetail, Registrations } from './pages/Events';
import { Dashboard, EventEditor, Attendees } from './pages/Organizer';
import { Management, Integrations, Login } from './pages/Admin';

function Guard({ roles, children }) {
  const { user } = useApp();
  return !user ? (
    <Navigate to='/login' replace />
  ) : roles && !roles.includes(user.role) ? (
    <Navigate to='/' replace />
  ) : (
    children
  );
}
function Shell() {
  const { user, ready, error, logout, toast, setToast } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation(),
    navigate = useNavigate();
  const { data: registrations } = useResource(
    user?.role === 'STUDENT' ? '/registrations/me' : null
  );
  const upcoming =
    registrations?.filter(
      (r) => r.status === 'REGISTERED' && new Date(r.event.startAt) > new Date()
    ).length || 0;
  const manager = ['ADMIN', 'ORGANIZER'].includes(user?.role);
  const roleLabel = {
    STUDENT: 'Student',
    ORGANIZER: 'Organizer',
    ADMIN: 'Administrator'
  }[user?.role];
  const nav = (to, label, Icon, count) => (
    <NavLink
      to={to}
      end
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      <Icon size={18} strokeWidth={1.65} />
      <span>{label}</span>
      {count > 0 && (
        <span className='ml-auto rounded bg-[#dfe8d7] px-1.5 py-0.5 text-[10px] text-forest'>
          {count}
        </span>
      )}
    </NavLink>
  );
  if (!ready) return <Loading />;
  if (error)
    return (
      <div className='mx-auto max-w-xl p-10'>
        <ErrorMessage message={`Could not reach the campus server. ${error}`} />
        <button className='btn' onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  return (
    <div className='min-h-screen'>
      {mobileOpen && (
        <button
          className='fixed inset-0 z-30 bg-black/30 lg:hidden'
          aria-label='Close navigation'
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-58 flex-col border-r border-line bg-white transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <Link
          to='/'
          className='mx-7 mb-10 mt-8 flex items-center gap-2.5 text-[27px] font-semibold tracking-[-.065em]'
        >
          <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-[#e2efcc]'>
            <GraduationCap size={23} strokeWidth={1.6} />
          </span>
          campus<span className='-ml-2 text-forest'>.</span>
        </Link>
        <div className='mx-5 mb-7 flex items-center gap-3 rounded-lg border border-line bg-[#fcfdfb] p-3'>
          <span className='flex h-8 w-8 items-center justify-center rounded-md border border-[#e1e6db] bg-[#f0f3e9] text-forest'>
            <Building2 size={16} />
          </span>
          <div>
            <p className='text-xs font-semibold'>University workspace</p>
            <p className='mt-0.5 text-[10px] text-muted'>
              A place for every possibility
            </p>
          </div>
        </div>
        <div className='flex-1 overflow-y-auto px-4'>
          <p className='eyebrow mb-3 px-3 text-[#a0a79e]'>Explore</p>
          <nav className='space-y-1'>
            {nav('/', 'Discover events', Compass)}
            {nav('/calendar', 'Campus calendar', CalendarDays)}
            {(!user || user.role === 'STUDENT') &&
              nav('/registrations', 'My registrations', Ticket, upcoming)}
          </nav>
          {manager && (
            <>
              <p className='eyebrow mb-3 mt-8 px-3 text-[#a0a79e]'>Organize</p>
              <nav className='space-y-1'>
                {nav('/dashboard', 'Overview & events', LayoutDashboard)}
                {nav('/create', 'Create an event', Plus)}
                {nav('/integrations', 'Integrations', Link2)}
              </nav>
            </>
          )}
          {user?.role === 'ADMIN' && (
            <>
              <p className='eyebrow mb-3 mt-8 px-3 text-[#a0a79e]'>
                Administration
              </p>
              <nav className='space-y-1'>
                {nav('/admin/users', 'People', Users)}
                {nav('/admin/departments', 'Departments', Layers3)}
                {nav('/admin/rooms', 'Rooms & spaces', Building2)}
                {nav('/admin/api-keys', 'API keys', KeyRound)}
              </nav>
            </>
          )}
        </div>
        <div className='mx-5 mb-5 mt-6 rounded-xl border border-[#e4eadd] bg-[#f7f9f1] p-4'>
          <Leaf size={19} className='mb-3 text-forest' />
          <h3 className='text-sm font-semibold'>Make campus your own.</h3>
          <p className='mt-2 text-xs leading-5 text-muted'>
            A new skill. A new friend.
            <br />
            It all starts with showing up.
          </p>
          <Link
            className='mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-forest'
            to='/'
          >
            Find your next event <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className='flex items-center gap-3 border-t border-line px-5 py-4'>
          {user ? (
            <>
              <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1e3d5] text-xs font-semibold text-[#8b6441]'>
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-xs font-semibold'>{user.name}</p>
                <p className='mt-0.5 text-[10px] text-muted'>{roleLabel}</p>
              </div>
              <IconButton
                label='Sign out'
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut size={16} />
              </IconButton>
            </>
          ) : (
            <Link to='/login' className='btn btn-primary w-full'>
              Sign in <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </aside>
      <div className='lg:ml-58'>
        <header className='flex h-19 items-center justify-between gap-4 border-b border-line bg-white px-5 sm:px-9'>
          <div className='flex items-center gap-3'>
            <span className='lg:hidden'>
              <IconButton
                label='Open navigation'
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={21} />
              </IconButton>
            </span>
            <span className='text-xs text-muted'>Campus life</span>
            <span className='text-[#cbd1cb]'>/</span>
            <span className='text-xs font-medium'>
              {location.pathname === '/'
                ? 'Discover'
                : location.pathname.startsWith('/admin')
                  ? 'Administration'
                  : location.pathname.includes('calendar')
                    ? 'Calendar'
                    : location.pathname.includes('registrations')
                      ? 'My registrations'
                      : location.pathname.includes('login')
                        ? 'Sign in'
                        : manager
                          ? 'Your workspace'
                          : 'Events'}
            </span>
          </div>
          <div className='flex items-center gap-4'>
            <span className='hidden text-xs text-muted sm:block'>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
            <span className='hidden h-5 w-px bg-line sm:block' />
            <span className='flex items-center gap-2 text-xs'>
              <span className='h-1.5 w-1.5 rounded-full bg-[#739a5a]' />
              {roleLabel ? `${roleLabel} workspace` : 'Welcome to campus'}
            </span>
          </div>
        </header>
        <main className='mx-auto max-w-[1550px] px-5 py-8 sm:px-9'>
          <div key={location.pathname} className='fade-in'>
            <Routes>
              <Route path='/' element={<Discover />} />
              <Route path='/calendar' element={<Discover calendar />} />
              <Route path='/discover/:id' element={<EventDetail />} />
              <Route path='/login' element={<Login />} />
              <Route
                path='/registrations'
                element={
                  <Guard roles={['STUDENT']}>
                    <Registrations />
                  </Guard>
                }
              />
              <Route
                path='/dashboard'
                element={
                  <Guard roles={['ADMIN', 'ORGANIZER']}>
                    <Dashboard />
                  </Guard>
                }
              />
              <Route
                path='/create'
                element={
                  <Guard roles={['ADMIN', 'ORGANIZER']}>
                    <EventEditor />
                  </Guard>
                }
              />
              <Route
                path='/edit/:id'
                element={
                  <Guard roles={['ADMIN', 'ORGANIZER']}>
                    <EventEditor />
                  </Guard>
                }
              />
              <Route
                path='/attendees/:id'
                element={
                  <Guard roles={['ADMIN', 'ORGANIZER']}>
                    <Attendees />
                  </Guard>
                }
              />
              <Route
                path='/integrations'
                element={
                  <Guard roles={['ADMIN', 'ORGANIZER']}>
                    <Integrations />
                  </Guard>
                }
              />
              <Route
                path='/admin/:resource'
                element={
                  <Guard roles={['ADMIN']}>
                    <Management />
                  </Guard>
                }
              />
              <Route path='*' element={<Navigate to='/' replace />} />
            </Routes>
          </div>
        </main>
        <footer className='mx-5 flex flex-wrap justify-between gap-2 border-t border-line py-5 text-[10px] text-[#9aa19b] sm:mx-9'>
          <span>Campus · Made for the moments beyond the classroom.</span>
          <span>Your campus. Your people. Your next thing.</span>
        </footer>
      </div>
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          className='fixed bottom-6 right-6 z-50 flex max-w-[calc(100vw-48px)] items-center gap-3 rounded-xl border border-line bg-white px-5 py-4 shadow-xl'
        >
          {toast.type === 'error' ? (
            <AlertCircle size={19} className='shrink-0 text-red-600' />
          ) : (
            <CheckCircle2 size={19} className='shrink-0 text-forest' />
          )}
          <p className='max-w-sm text-sm'>{toast.message}</p>
          <IconButton
            label='Dismiss notification'
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
