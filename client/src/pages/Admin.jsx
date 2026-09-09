import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  CheckCircle2,
  KeyRound,
  CalendarDays,
  Link2,
  ShieldCheck,
  ArrowRight,
  GraduationCap,
  Search,
  ExternalLink
} from 'lucide-react';
import { useApp, useResource } from '../context/AppContext';
import { api, setToken } from '../services/api';
import {
  PageHeader,
  Loading,
  ErrorMessage,
  Empty,
  Modal,
  Field,
  date
} from '../components/UI';

const managementConfig = {
  users: {
    title: 'The people of campus',
    eyebrow: 'People',
    subtitle: 'Give everyone the right space to contribute.',
    endpoint: '/users'
  },
  departments: {
    title: 'Many disciplines. One campus.',
    eyebrow: 'Departments',
    subtitle: 'Keep your campus communities connected.',
    endpoint: '/departments'
  },
  rooms: {
    title: 'A space for every idea.',
    eyebrow: 'Rooms & spaces',
    subtitle: 'Manage the places that bring your events to life.',
    endpoint: '/rooms'
  },
  'api-keys': {
    title: 'Connect your campus.',
    eyebrow: 'Peer API keys',
    subtitle: 'Manage secure access for AssistLink and your peer projects.',
    endpoint: '/admin/api-keys'
  }
};
export function Management() {
  const { resource } = useParams();
  if (!managementConfig[resource])
    return (
      <Empty title='Page not found' message='Choose a page from the sidebar.' />
    );
  return <ManagementPage key={resource} resource={resource} />;
}
function ManagementPage({ resource }) {
  const settings = managementConfig[resource],
    { notify, refresh, user } = useApp();
  const { data, loading, error } = useResource(settings.endpoint);
  const { data: departments } = useResource(
    resource === 'users' ? '/departments' : null
  );
  const [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [newKey, setNewKey] = useState(null),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState(''),
    [formError, setFormError] = useState('');
  const filtered = data?.filter((r) =>
    `${r.name || r.ownerLabel} ${r.email || ''} ${r.code || ''}`
      .toLowerCase()
      .includes(q.toLowerCase())
  );
  const noun = {
    departments: 'department',
    rooms: 'room',
    'api-keys': 'API key'
  }[resource];
  function openEdit(row) {
    setFormError('');
    setEdit(
      row ||
        (resource === 'rooms'
          ? { name: '', building: '', capacity: 50 }
          : resource === 'departments'
            ? { name: '', code: '' }
            : { ownerLabel: 'AssistLink', scope: ['assistlink:events:read'] })
    );
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const body =
      resource === 'rooms'
        ? {
            name: edit.name,
            building: edit.building,
            capacity: Number(edit.capacity)
          }
        : resource === 'departments'
          ? { name: edit.name, code: edit.code }
          : { ownerLabel: edit.ownerLabel, scope: edit.scope };
    try {
      const record = await api(
        `${settings.endpoint}${edit.id ? `/${edit.id}` : ''}`,
        { method: edit.id ? 'PATCH' : 'POST', body }
      );
      setEdit(null);
      if (record.key) setNewKey(record.key);
      refresh();
      notify(
        `${resource === 'api-keys' ? 'API key created' : 'Changes saved'}.`
      );
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function destroy() {
    setBusy(true);
    try {
      await api(`${settings.endpoint}/${remove.id}`, { method: 'DELETE' });
      refresh();
      setRemove(null);
      notify(
        resource === 'api-keys'
          ? 'API key revoked.'
          : `${noun[0].toUpperCase() + noun.slice(1)} deleted.`
      );
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function role(row, role) {
    setBusy(true);
    try {
      await api(`/users/${row.id}/role`, { method: 'PATCH', body: { role } });
      refresh();
      notify('Role updated.');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function department(row, departmentId) {
    setBusy(true);
    try {
      await api(`/users/${row.id}/department`, {
        method: 'PATCH',
        body: { departmentId: departmentId || null }
      });
      refresh();
      notify('Department updated.');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const bind = (key) => ({
    value: edit[key],
    onChange: (e) => setEdit({ ...edit, [key]: e.target.value })
  });
  return (
    <>
      <PageHeader {...settings}>
        {resource !== 'users' && (
          <button className='btn btn-primary' onClick={() => openEdit()}>
            <Plus size={16} />{' '}
            {resource === 'api-keys' ? 'Issue API key' : `Add ${noun}`}
          </button>
        )}
      </PageHeader>
      <label className='relative mb-6 block max-w-sm'>
        <Search size={15} className='absolute left-3.5 top-3.5 text-muted' />
        <input
          className='input pl-10!'
          aria-label={`Search ${resource}`}
          placeholder={`Search ${settings.eyebrow.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : !filtered?.length ? (
        <Empty
          title={`No ${settings.eyebrow.toLowerCase()} here yet`}
          message={
            q
              ? 'Try a different search.'
              : 'Add your first record to get started.'
          }
        />
      ) : (
        <div className='panel overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr>
                {(resource === 'users'
                  ? ['Person', 'Department', 'Role']
                  : resource === 'rooms'
                    ? ['Room', 'Building', 'Capacity', 'Bookings', 'Actions']
                    : resource === 'departments'
                      ? ['Department', 'Code', 'People', 'Events', 'Actions']
                      : ['Owner', 'Permissions', 'Created', 'Status', 'Actions']
                ).map((s) => (
                  <th className='table-th' key={s}>
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className='table-td'>
                    <span className='text-sm font-medium'>
                      {row.name || row.ownerLabel}
                    </span>
                    {row.email && (
                      <p className='mt-1 text-xs text-muted'>{row.email}</p>
                    )}
                  </td>
                  {resource === 'users' ? (
                    <>
                      <td className='table-td'>
                        <select
                          className='input w-52! py-1.5! text-xs!'
                          aria-label={`Department for ${row.name}`}
                          value={row.departmentId || ''}
                          disabled={busy || !departments?.length}
                          onChange={(e) => department(row, e.target.value)}
                        >
                          <option value=''>Not assigned</option>
                          {departments?.map((d) => (
                            <option value={d.id} key={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className='table-td'>
                        <select
                          className='input w-auto! py-1.5! text-xs!'
                          aria-label={`Role for ${row.name}`}
                          value={row.role}
                          disabled={busy || row.id === user.id}
                          onChange={(e) => role(row, e.target.value)}
                        >
                          <option value='STUDENT'>Student</option>
                          <option value='ORGANIZER'>Organizer</option>
                          <option value='ADMIN'>Administrator</option>
                        </select>
                        {row.id === user.id && (
                          <span className='ml-2 text-[10px] text-muted'>
                            You
                          </span>
                        )}
                      </td>
                    </>
                  ) : resource === 'rooms' ? (
                    <>
                      <td className='table-td text-xs text-muted'>
                        {row.building}
                      </td>
                      <td className='table-td text-xs'>
                        {row.capacity} people
                      </td>
                      <td className='table-td text-xs'>
                        {row._count.bookings}
                      </td>
                    </>
                  ) : resource === 'departments' ? (
                    <>
                      <td className='table-td text-xs'>
                        <span className='rounded bg-[#f0f3ea] px-2 py-1 text-forest'>
                          {row.code}
                        </span>
                      </td>
                      <td className='table-td text-xs'>{row._count.users}</td>
                      <td className='table-td text-xs'>{row._count.events}</td>
                    </>
                  ) : (
                    <>
                      <td className='table-td'>
                        {row.scope.map((s) => (
                          <p
                            className='py-0.5 font-mono text-[10px] text-muted'
                            key={s}
                          >
                            {s}
                          </p>
                        ))}
                      </td>
                      <td className='table-td text-xs text-muted'>
                        {date(row.createdAt)}
                      </td>
                      <td className='table-td'>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] ${row.active ? 'bg-green-50 text-forest' : 'bg-slate-100 text-muted'}`}
                        >
                          {row.active ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                    </>
                  )}
                  {resource !== 'users' && (
                    <td className='table-td'>
                      <div className='flex gap-3'>
                        {resource !== 'api-keys' && (
                          <button
                            className='btn p-2!'
                            aria-label={`Edit ${row.name}`}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {(resource !== 'api-keys' || row.active) && (
                          <button
                            className='btn p-2! text-red-600'
                            aria-label={`${resource === 'api-keys' ? 'Revoke' : 'Delete'} ${row.name || row.ownerLabel}`}
                            onClick={() => setRemove(row)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal
          title={`${edit.id ? 'Edit' : 'Add'} ${noun}`}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save} className='space-y-5'>
            {resource === 'api-keys' ? (
              <>
                <Field label='Key owner' required {...bind('ownerLabel')} />
                <fieldset>
                  <legend className='label'>Permissions</legend>
                  {['assistlink:events:read', 'assistlink:events:register'].map(
                    (scope) => (
                      <label
                        className='mb-3 flex items-center gap-2 text-sm'
                        key={scope}
                      >
                        <input
                          type='checkbox'
                          className='accent-forest'
                          checked={edit.scope.includes(scope)}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              scope: e.target.checked
                                ? [...edit.scope, scope]
                                : edit.scope.filter((s) => s !== scope)
                            })
                          }
                        />
                        {scope === 'assistlink:events:read'
                          ? 'Read published events'
                          : 'Register students for events'}
                      </label>
                    )
                  )}
                </fieldset>
                <p className='text-xs leading-5 text-muted'>
                  The secret key is shown only once. Copy it after creation and
                  share it securely with your peer project.
                </p>
              </>
            ) : (
              <>
                <Field label='Name' required minLength={2} {...bind('name')} />
                {resource === 'rooms' ? (
                  <>
                    <Field label='Building' required {...bind('building')} />
                    <Field
                      label='Capacity'
                      required
                      type='number'
                      min='1'
                      max='10000'
                      {...bind('capacity')}
                    />
                  </>
                ) : (
                  <Field
                    label='Department code'
                    required
                    minLength={2}
                    maxLength={12}
                    {...bind('code')}
                  />
                )}
              </>
            )}
            {formError && <ErrorMessage message={formError} />}
            <div className='flex justify-end gap-3'>
              <button
                type='button'
                className='btn'
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button className='btn btn-primary' disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          title={
            resource === 'api-keys' ? 'Revoke API key?' : `Delete this ${noun}?`
          }
          onClose={() => setRemove(null)}
        >
          <p className='text-sm leading-6 text-muted'>
            {resource === 'api-keys'
              ? `${remove.ownerLabel} will no longer be able to use this key. This cannot be undone.`
              : `${remove.name} will be deleted. Records that are still in use cannot be removed.`}
          </p>
          <div className='mt-6 flex justify-end gap-3'>
            <button className='btn' onClick={() => setRemove(null)}>
              Keep it
            </button>
            <button
              className='btn btn-danger'
              onClick={destroy}
              disabled={busy}
            >
              {busy
                ? 'Updating…'
                : resource === 'api-keys'
                  ? 'Revoke key'
                  : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
      {newKey && (
        <Modal title='Your new API key' onClose={() => setNewKey(null)}>
          <p className='mb-4 text-sm text-muted'>
            Copy this key now. It will not be shown again.
          </p>
          <code className='block break-all rounded-lg bg-slate-50 p-4 text-xs'>
            {newKey}
          </code>
          <div className='mt-5 flex justify-end gap-3'>
            <button
              className='btn'
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(newKey);
                  notify('Key copied to clipboard.');
                } catch {
                  notify(
                    'Select and copy the displayed key manually.',
                    'error'
                  );
                }
              }}
            >
              <Copy size={14} /> Copy key
            </button>
            <button className='btn btn-primary' onClick={() => setNewKey(null)}>
              I’ve saved it
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Integrations() {
  const { data, loading, error } = useResource('/integrations');
  const { user } = useApp();
  const connections = [
    {
      key: 'googleCalendar',
      title: 'Google Calendar',
      icon: CalendarDays,
      desc: 'Published events appear in the shared campus calendar. Edits and cancellations stay in sync.',
      note: 'Requires a calendar ID and Google OAuth credentials on the server.'
    },
    {
      key: 'assistLink',
      title: 'AssistLink',
      icon: Link2,
      desc: 'Connect campus events with research and teaching assistantship opportunities.',
      note: 'Requires the peer server URL and an issued AssistLink API key.'
    },
    {
      key: 'microsoft',
      title: 'Microsoft university sign-in',
      icon: ShieldCheck,
      desc: 'One university identity for everyone. Sign in securely with your Microsoft Entra account.',
      note: 'Requires a university tenant and registered frontend and API applications.'
    },
    {
      key: 'keyVault',
      title: 'Azure Key Vault',
      icon: KeyRound,
      desc: 'Production secrets are retrieved securely when the server starts.',
      note: 'Active in production with a configured vault and managed identity.'
    }
  ];
  return (
    <>
      <PageHeader
        title='Better, connected.'
        eyebrow='Integrations'
        subtitle='The services that help campus work together.'
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <div className='grid gap-5 md:grid-cols-2'>
          {connections.map(({ key, title, icon: Icon, desc, note }) => (
            <div key={key} className='panel p-6'>
              <div className='mb-5 flex items-center justify-between'>
                <span className='rounded-xl bg-[#edf3e8] p-3 text-forest'>
                  <Icon size={23} />
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${data[key] ? 'bg-green-50 text-forest' : 'bg-amber-50 text-amber-700'}`}
                >
                  {data[key] ? 'Configured' : 'Setup needed'}
                </span>
              </div>
              <h2 className='text-xl font-semibold'>{title}</h2>
              <p className='mt-3 text-sm leading-6 text-muted'>{desc}</p>
              <p className='mt-5 border-t border-line pt-4 text-xs leading-5 text-muted'>
                {note}
              </p>
              {key === 'assistLink' && user.role === 'ADMIN' && (
                <Link
                  to='/admin/api-keys'
                  className='mt-4 inline-flex items-center gap-2 text-xs font-semibold text-forest'
                >
                  Manage peer API keys <ArrowRight size={13} />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
let msal;
export function Login() {
  const { config, setUser, user } = useApp(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function microsoft() {
    setBusy(true);
    setError('');
    try {
      if (!msal) {
        const { PublicClientApplication } = await import('@azure/msal-browser');
        msal = new PublicClientApplication({
          auth: {
            clientId: config.microsoft.clientId,
            authority: `https://login.microsoftonline.com/${config.microsoft.tenantId}`,
            redirectUri: new URL(
              import.meta.env.BASE_URL,
              window.location.origin
            ).href
          },
          cache: { cacheLocation: 'sessionStorage' }
        });
        await msal.initialize();
      }
      const result = await msal.loginPopup({
        scopes: [config.microsoft.scope],
        prompt: 'select_account'
      });
      const session = await api('/auth/microsoft', {
        method: 'POST',
        body: { accessToken: result.accessToken }
      });
      setToken(session.token);
      setUser(session.user);
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className='mx-auto grid min-h-170 max-w-4xl items-center gap-12 py-12 md:grid-cols-2'>
      <div>
        <div className='mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-[#dbe9c8]'>
          <GraduationCap size={34} />
        </div>
        <p className='eyebrow mb-4 text-forest'>A little more campus life</p>
        <h1 className='text-5xl font-semibold leading-[1.1]'>
          Your people.
          <br />
          Your possibilities.
          <br />
          <span className='text-forest'>Your campus.</span>
        </h1>
        <p className='mt-6 max-w-sm text-base leading-7 text-muted'>
          The best parts of university aren’t always on the timetable. Find your
          next one here.
        </p>
      </div>
      <section className='panel p-8'>
        <h2 className='text-2xl font-semibold'>Welcome to campus.</h2>
        <p className='mb-7 mt-2 text-sm text-muted'>
          Sign in to save your spot and make new plans.
        </p>
        {user ? (
          <Link className='btn btn-primary w-full' to='/'>
            Continue as {user.name.split(' ')[0]} <ArrowRight size={15} />
          </Link>
        ) : (
          <button
            className='btn w-full py-3.5!'
            disabled={
              busy || !config.microsoft.clientId || !config.microsoft.scope
            }
            onClick={microsoft}
          >
            <span className='grid grid-cols-2 gap-0.5'>
              {['#f35325', '#81bc06', '#05a6f0', '#ffba08'].map((c) => (
                <span key={c} className='h-2 w-2' style={{ background: c }} />
              ))}
            </span>
            {busy ? 'Signing in…' : 'Continue with Microsoft'}
          </button>
        )}
        {!config.microsoft.clientId && (
          <p className='mt-3 text-xs leading-5 text-muted'>
            University sign-in is available after Microsoft tenant values are
            configured on the server.
          </p>
        )}
        {error && <ErrorMessage message={error} />}
      </section>
    </div>
  );
}
