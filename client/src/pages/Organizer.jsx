import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Users,
  CalendarDays,
  Ticket,
  TrendingUp,
  Pencil,
  Search,
  Download,
  Link2
} from 'lucide-react';
import { useApp, useResource } from '../context/AppContext';
import { api } from '../services/api';
import {
  categories,
  Badge,
  PageHeader,
  Loading,
  ErrorMessage,
  Empty,
  Field,
  Modal,
  date,
  time
} from '../components/UI';

export function Dashboard() {
  const { user, notify, refresh } = useApp();
  const { data: events, loading, error } = useResource('/events?manage=true');
  const [tab, setTab] = useState('All'),
    [q, setQ] = useState(''),
    [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false);
  const filtered = events?.filter(
    (e) =>
      (tab === 'All' || e.status === tab.toUpperCase()) &&
      e.title.toLowerCase().includes(q.toLowerCase())
  );
  async function action(event, action) {
    setBusy(true);
    try {
      const destructive = ['cancel', 'delete'].includes(action);
      const updated = await api(
        `/events/${event.id}${destructive ? '' : `/${action}`}`,
        { method: destructive ? 'DELETE' : 'POST' }
      );
      refresh();
      setConfirm(null);
      notify(
        action === 'publish'
          ? `Event published.${updated.calendarSyncStatus === 'SYNCED' ? ' Google Calendar is up to date.' : ' Calendar sync: ' + updated.calendarSyncStatus.toLowerCase().replaceAll('_', ' ') + '.'}`
          : action === 'close'
            ? 'Registration is now closed.'
            : action === 'delete'
              ? 'Cancelled event deleted.'
              : 'Event cancelled and registrations released.'
      );
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow={
          user.role === 'ADMIN' ? 'Campus overview' : 'Organizer workspace'
        }
        title={`Hello, ${user.name.split(' ')[0]}.`}
        subtitle='Bring people together. Make something worth showing up for.'
      >
        <Link to='/create' className='btn btn-primary'>
          <Plus size={16} /> Create event
        </Link>
      </PageHeader>
      <div className='mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4'>
        {[
          [
            'Total events',
            events?.length || 0,
            CalendarDays,
            'Across your workspace'
          ],
          [
            'Published',
            events?.filter((e) => e.status === 'PUBLISHED').length || 0,
            ArrowUpRight,
            'Ready to be discovered'
          ],
          [
            'Registrations',
            events?.reduce((n, e) => n + e._count.registrations, 0) || 0,
            Ticket,
            'Real people, shared moments'
          ],
          [
            'Upcoming events',
            events?.filter(
              (e) =>
                e.status === 'PUBLISHED' && new Date(e.startAt) > new Date()
            ).length || 0,
            TrendingUp,
            'Something to look forward to'
          ]
        ].map(([label, value, Icon, sub]) => (
          <div className='panel p-5' key={label}>
            <div className='mb-5 flex items-center justify-between text-xs text-muted'>
              {label}
              <Icon size={17} className='text-forest' />
            </div>
            <span className='text-3xl font-semibold'>{value}</span>
            <p className='mt-2 text-[10px] text-muted'>{sub}</p>
          </div>
        ))}
      </div>
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-xl font-semibold'>
          {user.role === 'ADMIN' ? 'All campus events' : 'Your events'}
        </h2>
        <label className='relative'>
          <Search className='absolute left-3 top-3 text-muted' size={15} />
          <input
            className='input pl-9!'
            placeholder='Find an event…'
            aria-label='Search managed events'
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      <div className='mb-5 flex gap-2 overflow-auto'>
        {['All', 'Draft', 'Published', 'Closed', 'Cancelled'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`category-pill ${t === tab ? 'selected' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : !filtered.length ? (
        <Empty
          title='Ready for your next idea?'
          message='Create an event and give your campus something to look forward to.'
          action={
            <Link className='btn btn-primary' to='/create'>
              Create an event
            </Link>
          }
        />
      ) : (
        <div className='panel overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr>
                {['Event', 'Status', 'Registrations', 'Calendar', 'Manage'].map(
                  (s) => (
                    <th key={s} className='table-th'>
                      {s}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr key={event.id}>
                  <td className='table-td min-w-60'>
                    <Link
                      className='text-sm font-semibold hover:text-forest'
                      to={`/discover/${event.id}`}
                    >
                      {event.title}
                    </Link>
                    <p className='mt-1.5 text-[11px] text-muted'>
                      {date(event.startAt)} · {time(event.startAt)}
                    </p>
                  </td>
                  <td className='table-td'>
                    <Badge status={event.status} />
                  </td>
                  <td className='table-td text-xs text-muted'>
                    {event._count.registrations} / {event.capacity}
                    <div className='mt-2 h-1 w-20 rounded bg-[#eaf0e5]'>
                      <div
                        className='h-1 rounded bg-[#89a76a]'
                        style={{
                          width: `${Math.min(100, (event._count.registrations / event.capacity) * 100)}%`
                        }}
                      />
                    </div>
                  </td>
                  <td className='table-td'>
                    <span className='text-[10px] text-muted'>
                      {event.calendarSyncStatus
                        .toLowerCase()
                        .replaceAll('_', ' ')}
                    </span>
                    {event.status !== 'DRAFT' &&
                      event.calendarSyncStatus === 'ERROR' && (
                        <button
                          disabled={busy}
                          className='mt-1 block text-xs text-forest underline'
                          onClick={() => action(event, 'calendar-sync')}
                        >
                          Retry sync
                        </button>
                      )}
                  </td>
                  <td className='table-td'>
                    <div className='flex items-center gap-2'>
                      <Link
                        aria-label={`Attendees for ${event.title}`}
                        title='Attendees'
                        className='btn p-2!'
                        to={`/attendees/${event.id}`}
                      >
                        <Users size={14} />
                      </Link>
                      {!['CLOSED', 'CANCELLED'].includes(event.status) && (
                        <Link
                          aria-label={`Edit ${event.title}`}
                          className='btn p-2!'
                          to={`/edit/${event.id}`}
                        >
                          <Pencil size={14} />
                        </Link>
                      )}
                      {event.status === 'DRAFT' && (
                        <button
                          disabled={busy}
                          className='btn px-3! py-2! text-xs! text-forest'
                          onClick={() => action(event, 'publish')}
                        >
                          Publish
                        </button>
                      )}
                      {event.status === 'PUBLISHED' && (
                        <button
                          disabled={busy}
                          className='btn px-3! py-2! text-xs!'
                          onClick={() => setConfirm({ event, action: 'close' })}
                        >
                          Close
                        </button>
                      )}
                      {event.status !== 'CANCELLED' && (
                        <button
                          className='text-[11px] text-red-600'
                          disabled={busy}
                          onClick={() =>
                            setConfirm({ event, action: 'cancel' })
                          }
                        >
                          Cancel
                        </button>
                      )}
                      {event.status === 'CANCELLED' &&
                        user.role === 'ADMIN' && (
                          <button
                            className='text-[11px] text-red-600'
                            disabled={busy}
                            onClick={() =>
                              setConfirm({ event, action: 'delete' })
                            }
                          >
                            Delete
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirm && (
        <Modal
          title={
            confirm.action === 'delete'
              ? 'Delete cancelled event?'
              : confirm.action === 'cancel'
                ? 'Cancel this event?'
                : 'Close registration?'
          }
          onClose={() => setConfirm(null)}
        >
          <p className='text-sm leading-6 text-muted'>
            {confirm.event.title}.{' '}
            {confirm.action === 'delete'
              ? 'This permanently removes the cancelled event and its registration records.'
              : confirm.action === 'cancel'
                ? 'All active registrations will be cancelled and the room booking will be released.'
                : 'Existing registrations will be kept. Students will no longer be able to join.'}
          </p>
          <div className='mt-6 flex justify-end gap-3'>
            <button className='btn' onClick={() => setConfirm(null)}>
              Go back
            </button>
            <button
              className={`btn ${['cancel', 'delete'].includes(confirm.action) ? 'btn-danger' : 'btn-primary'}`}
              disabled={busy}
              onClick={() => action(confirm.event, confirm.action)}
            >
              {busy ? 'Updating…' : 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
const localDate = (value) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function EventEditor() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { user, notify, refresh } = useApp();
  const {
    data: event,
    loading,
    error
  } = useResource(id ? `/events/${id}` : null);
  const { data: departments, error: departmentError } =
      useResource('/departments'),
    { data: rooms, error: roomError } = useResource('/rooms');
  const [values, setValues] = useState({
      title: '',
      description: '',
      category: 'Technology',
      departmentId: user.departmentId || '',
      location: '',
      capacity: 50,
      roomId: '',
      startAt: '',
      endAt: '',
      registrationClosesAt: '',
      externalEventId: ''
    }),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState('');
  useEffect(() => {
    if (event)
      setValues({
        title: event.title,
        description: event.description,
        category: event.category,
        departmentId: event.departmentId,
        location: event.location,
        capacity: event.capacity,
        roomId: event.roomBookings[0]?.roomId || '',
        startAt: localDate(event.startAt),
        endAt: localDate(event.endAt),
        registrationClosesAt: event.registrationClosesAt
          ? localDate(event.registrationClosesAt)
          : '',
        externalEventId: event.externalEventId || ''
      });
  }, [event]);
  const bind = (key) => ({
    value: values[key],
    onChange: (e) => setValues((v) => ({ ...v, [key]: e.target.value }))
  });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const body = {
        ...values,
        capacity: Number(values.capacity),
        roomId: values.roomId || null,
        startAt: new Date(values.startAt).toISOString(),
        endAt: new Date(values.endAt).toISOString(),
        registrationClosesAt: values.registrationClosesAt
          ? new Date(values.registrationClosesAt).toISOString()
          : null,
        externalEventId: values.externalEventId || null
      };
      await api(id ? `/events/${id}` : '/events', {
        method: id ? 'PATCH' : 'POST',
        body
      });
      refresh();
      notify(
        id
          ? 'Your event has been updated.'
          : 'Draft saved. Publish it when you’re ready.'
      );
      navigate('/dashboard');
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (id && loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  return (
    <>
      <Link
        to='/dashboard'
        className='mb-6 inline-flex items-center gap-2 text-xs text-muted'
      >
        <ArrowLeft size={14} /> Back to your events
      </Link>
      <PageHeader
        title={id ? 'Make it even better.' : 'Start something good.'}
        eyebrow={id ? 'Edit event' : 'Create an event'}
        subtitle='A few details are all it takes to bring people together.'
      />
      <form
        onSubmit={submit}
        className='grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]'
      >
        <div className='space-y-6'>
          <section className='panel space-y-5 p-6'>
            <h2 className='text-lg font-semibold'>The essentials</h2>
            <Field
              label='Event title'
              required
              minLength={3}
              maxLength={150}
              placeholder='Give your event a name worth remembering'
              {...bind('title')}
            />
            <Field label='What’s the event about?'>
              <textarea
                className='input min-h-36 resize-y'
                required
                minLength={20}
                maxLength={10000}
                placeholder='Tell people what to expect, what to bring, and why they should come.'
                {...bind('description')}
              />
            </Field>
            <div className='grid gap-5 sm:grid-cols-2'>
              <Field label='Category'>
                <select className='input' {...bind('category')}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label='Hosting department'>
                <select className='input' required {...bind('departmentId')}>
                  <option value=''>Choose a department</option>
                  {departments?.map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
          <section className='panel space-y-5 p-6'>
            <h2 className='text-lg font-semibold'>A time and a place</h2>
            <div className='grid gap-5 sm:grid-cols-2'>
              <Field
                label='Starts at'
                type='datetime-local'
                required
                {...bind('startAt')}
              />
              <Field
                label='Ends at'
                type='datetime-local'
                required
                {...bind('endAt')}
              />
            </div>
            <Field label='Campus room (optional)'>
              <select
                className='input'
                value={values.roomId}
                onChange={(e) => {
                  const room = rooms?.find((r) => r.id === e.target.value);
                  setValues((v) => ({
                    ...v,
                    roomId: e.target.value,
                    ...(room
                      ? { location: `${room.name}, ${room.building}` }
                      : {})
                  }));
                }}
              >
                <option value=''>Off-site / outdoor / custom location</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.building} · {r.capacity} people
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label='Location'
              required
              maxLength={200}
              placeholder='Where should everyone meet?'
              {...bind('location')}
            />
            <div className='grid gap-5 sm:grid-cols-2'>
              <Field
                label='Number of spots'
                type='number'
                min='1'
                max='10000'
                required
                {...bind('capacity')}
              />
              <Field
                label='Registration closes (optional)'
                type='datetime-local'
                {...bind('registrationClosesAt')}
              />
            </div>
            <p className='text-xs leading-5 text-muted'>
              Room availability and capacity are checked when you save.
              Registration closes at the event’s start time unless you set an
              earlier deadline.
            </p>
          </section>
          <section className='panel p-6'>
            <h2 className='mb-4 text-lg font-semibold'>
              AssistLink connection
            </h2>
            <Field
              label='AssistLink event ID (optional)'
              placeholder='Link a corresponding AssistLink event'
              maxLength={100}
              {...bind('externalEventId')}
            />
          </section>
          {(formError || departmentError || roomError) && (
            <ErrorMessage message={formError || departmentError || roomError} />
          )}
          <div className='flex justify-end gap-3'>
            <Link to='/dashboard' className='btn'>
              Cancel
            </Link>
            <button type='submit' className='btn btn-primary' disabled={busy}>
              {busy ? 'Saving…' : id ? 'Save changes' : 'Save as draft'}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
        <aside className='rounded-xl border border-[#e2e8d9] bg-[#f0f4e9] p-6'>
          <CalendarDays className='mb-4 text-forest' size={26} />
          <h3 className='text-lg font-semibold'>
            Good details. Great turnout.
          </h3>
          <p className='mt-3 text-sm leading-6 text-muted'>
            Keep the title clear, let people know what they’ll take away, and
            make the meeting point easy to find.
          </p>
          <div className='my-5 border-t border-[#dce4d4]' />
          <p className='text-xs leading-6 text-forest'>
            New events start as drafts. You can review everything before
            publishing to campus.
          </p>
        </aside>
      </form>
    </>
  );
}

export function Attendees() {
  const { id } = useParams(),
    { notify, refresh } = useApp();
  const { data: event } = useResource(`/events/${id}`),
    { data, loading, error } = useResource(`/events/${id}/registrations`);
  const [q, setQ] = useState(''),
    [busy, setBusy] = useState(''),
    [peer, setPeer] = useState(null);
  const filtered = data?.filter((r) =>
    `${r.student.name} ${r.student.email}`
      .toLowerCase()
      .includes(q.toLowerCase())
  );
  async function mark(registration, status) {
    setBusy(registration.id);
    try {
      await api(`/registrations/${registration.id}`, {
        method: 'PATCH',
        body: { status }
      });
      refresh();
      notify('Attendance updated.');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy('');
    }
  }
  async function loadPeer() {
    setBusy('peer');
    try {
      setPeer(await api(`/events/${id}/assistlink-registrations`));
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <Link
        to='/dashboard'
        className='mb-6 inline-flex items-center gap-2 text-xs text-muted'
      >
        <ArrowLeft size={14} /> Back to your events
      </Link>
      <PageHeader
        title='The people making it happen'
        eyebrow='Registrations & attendance'
        subtitle={event?.title}
      >
        <button className='btn' disabled={!!busy} onClick={loadPeer}>
          <Link2 size={15} /> View AssistLink registrations
        </button>
      </PageHeader>
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-muted'>
          {data?.filter((r) => r.status !== 'CANCELLED').length || 0} registered
          · {data?.filter((r) => r.status === 'ATTENDED').length || 0} attended
        </p>
        <input
          className='input w-auto!'
          aria-label='Search attendees'
          placeholder='Search name or email…'
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {event && new Date(event.startAt) > new Date() && (
        <p className='mb-5 rounded-lg bg-[#eef3e7] px-4 py-3 text-xs text-forest'>
          Attendance marking opens when the event starts, {date(event.startAt)}{' '}
          at {time(event.startAt)}.
        </p>
      )}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : !filtered?.length ? (
        <Empty
          title='The guest list is getting started'
          message='Registrations will appear here as students join your event.'
        />
      ) : (
        <div className='panel overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr>
                {[
                  'Student',
                  'Department',
                  'Source',
                  'Registered',
                  'Attendance'
                ].map((t) => (
                  <th className='table-th' key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className='table-td'>
                    <p className='text-sm font-medium'>{r.student.name}</p>
                    <p className='mt-1 text-xs text-muted'>{r.student.email}</p>
                  </td>
                  <td className='table-td text-xs text-muted'>
                    {r.student.department?.name || 'Not specified'}
                  </td>
                  <td className='table-td text-xs text-muted'>
                    {r.source === 'ASSISTLINK' ? 'AssistLink' : 'Campus'}
                  </td>
                  <td className='table-td text-xs text-muted'>
                    {date(r.registeredAt)}
                  </td>
                  <td className='table-td'>
                    {r.status === 'CANCELLED' ? (
                      <Badge status={r.status} />
                    ) : (
                      <select
                        aria-label={`Attendance for ${r.student.name}`}
                        className='input w-auto! py-1.5! text-xs!'
                        value={r.status}
                        disabled={
                          busy === r.id ||
                          (event && new Date(event.startAt) > new Date())
                        }
                        onChange={(e) => mark(r, e.target.value)}
                      >
                        <option value='REGISTERED'>Registered</option>
                        <option value='ATTENDED'>Attended</option>
                        <option value='ABSENT'>Absent</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {peer && (
        <Modal title='AssistLink registrations' onClose={() => setPeer(null)}>
          {peer.length ? (
            <div className='space-y-4'>
              {peer.map((r, i) => (
                <div key={i} className='border-b border-line pb-3'>
                  <p className='font-medium'>{r.name}</p>
                  <p className='mt-1 text-xs text-muted'>
                    {r.email} · {r.department || 'Department not supplied'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-sm text-muted'>
              No registrations returned by AssistLink.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
