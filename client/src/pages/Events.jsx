import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Users,
  ArrowUpRight,
  CheckCircle2,
  Ticket,
  Download,
  ArrowRight,
  GraduationCap
} from 'lucide-react';
import { useApp, useResource } from '../context/AppContext';
import { api } from '../services/api';
import {
  Poster,
  Loading,
  ErrorMessage,
  Badge,
  PageHeader,
  Empty,
  Modal,
  date,
  time
} from '../components/UI';

function CalendarDownload({ event }) {
  const download = () => {
    const stamp = (value) =>
      new Date(value)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
    const escape = (v) =>
      v
        .replaceAll('\\', '\\\\')
        .replaceAll('\n', '\\n')
        .replaceAll(',', '\\,')
        .replaceAll(';', '\\;')
        .replaceAll('\r', '');
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Campus//Events//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}@campus`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(event.startAt)}`,
      `DTEND:${stamp(event.endAt)}`,
      `SUMMARY:${escape(event.title)}`,
      `LOCATION:${escape(event.location)}`,
      `DESCRIPTION:${escape(event.description)}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/calendar;charset=utf-8' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campus-event.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <button className='btn w-full' onClick={download}>
      <Download size={15} /> Add to my calendar
    </button>
  );
}
export function EventDetail() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { user, notify, refresh } = useApp();
  const { data: event, loading, error } = useResource(`/events/${id}`);
  const { data: registrations } = useResource(
    user?.role === 'STUDENT' ? '/registrations/me' : null
  );
  const [busy, setBusy] = useState(false),
    [cancel, setCancel] = useState(false);
  const registration = registrations?.find(
    (r) => r.eventId === id && r.status !== 'CANCELLED'
  );
  async function book(cancelling = false) {
    if (!user) return navigate('/login');
    setBusy(true);
    try {
      await api(`/events/${id}/registrations${cancelling ? '/me' : ''}`, {
        method: cancelling ? 'DELETE' : 'POST'
      });
      refresh();
      setCancel(false);
      notify(
        cancelling
          ? 'Your registration has been cancelled.'
          : 'You’re on the list! We’ll see you there.'
      );
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  const spots = event.capacity - event._count.registrations;
  const closed =
    event.status !== 'PUBLISHED' ||
    new Date(event.registrationClosesAt || event.startAt) <= new Date();
  const canManage =
    user?.role === 'ADMIN' ||
    (user?.role === 'ORGANIZER' && event.organizerId === user.id);
  return (
    <>
      <Link
        to='/'
        className='mb-6 inline-flex items-center gap-2 text-xs text-muted hover:text-forest'
      >
        <ArrowLeft size={14} /> Back to discovery
      </Link>
      <div className='grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_315px]'>
        <div>
          <div className='overflow-hidden rounded-2xl'>
            <Poster event={event} large />
          </div>
          <div className='mt-7 flex items-center gap-3'>
            <span className='rounded-full bg-[#edf2e7] px-3 py-1 text-xs font-medium text-forest'>
              {event.category}
            </span>
            <Badge status={event.status} />
          </div>
          <h1 className='mt-4 text-[34px] font-semibold leading-tight sm:text-[40px]'>
            {event.title}
          </h1>
          <p className='mt-3 text-sm text-muted'>
            Hosted by{' '}
            <span className='font-medium text-ink'>{event.organizer.name}</span>{' '}
            · {event.department.name}
          </p>
          <div className='my-7 border-t border-line' />
          <h2 className='mb-4 text-xl font-semibold'>
            A little about the event
          </h2>
          <p className='whitespace-pre-wrap text-base leading-8 text-[#727c75]'>
            {event.description}
          </p>
          <div className='panel mt-8 flex items-center gap-4 p-5'>
            <div className='rounded-xl bg-[#eff3e9] p-3 text-forest'>
              <GraduationCap size={24} />
            </div>
            <div>
              <p className='font-semibold'>{event.department.name}</p>
              <p className='mt-1 text-xs text-muted'>
                Open to students from every department.
              </p>
            </div>
          </div>
        </div>
        <aside className='panel p-6 xl:sticky xl:top-6'>
          <div className='mb-6 flex items-center justify-between'>
            <span className='text-2xl font-semibold'>Free</span>
            <span className='text-xs text-muted'>
              Make a little time for it.
            </span>
          </div>
          <div className='space-y-5'>
            <Detail
              icon={CalendarDays}
              label='Date'
              value={date(event.startAt, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            />
            <Detail
              icon={Clock3}
              label='Time'
              value={`${time(event.startAt)} – ${time(event.endAt)}`}
            />
            <Detail icon={MapPin} label='Location' value={event.location} />
            <Detail
              icon={Users}
              label='Who’s coming'
              value={`${event._count.registrations} of ${event.capacity} spots booked`}
            />
          </div>
          <div className='mb-2 mt-6 h-1.5 overflow-hidden rounded-full bg-[#edf0e8]'>
            <div
              className='h-full rounded-full bg-[#80a565]'
              style={{
                width: `${Math.min(100, (event._count.registrations / event.capacity) * 100)}%`
              }}
            />
          </div>
          <p className='mb-5 text-[11px] text-muted'>
            {spots > 0
              ? `${spots} spots left. There’s a place for you.`
              : 'This event is fully booked.'}
          </p>
          {canManage ? (
            <div className='space-y-2'>
              <Link className='btn btn-primary w-full' to={`/attendees/${id}`}>
                Manage attendees <Users size={15} />
              </Link>
              {!['CANCELLED', 'CLOSED'].includes(event.status) && (
                <Link className='btn w-full' to={`/edit/${id}`}>
                  Edit event <ArrowUpRight size={15} />
                </Link>
              )}
              <p className='pt-2 text-xs text-muted'>
                Calendar:{' '}
                {event.calendarSyncStatus.toLowerCase().replaceAll('_', ' ')}
              </p>
            </div>
          ) : registration ? (
            <>
              <div className='mb-3 flex items-center justify-center gap-2 rounded-lg bg-[#edf3e6] p-3 font-medium text-forest'>
                <CheckCircle2 size={17} /> You’re on the list
              </div>
              <CalendarDownload event={event} />
              {registration.status === 'REGISTERED' &&
                new Date(event.startAt) > new Date() && (
                  <button
                    className='mt-4 w-full text-xs text-muted underline underline-offset-4'
                    onClick={() => setCancel(true)}
                  >
                    Cancel my registration
                  </button>
                )}
            </>
          ) : (
            <>
              <button
                className='btn btn-primary w-full'
                disabled={
                  busy ||
                  closed ||
                  spots <= 0 ||
                  (!!user && user.role !== 'STUDENT')
                }
                onClick={() => book()}
              >
                {busy
                  ? 'Saving your spot…'
                  : closed
                    ? 'Registration closed'
                    : spots <= 0
                      ? 'Fully booked'
                      : !user
                        ? 'Sign in to register'
                        : user.role !== 'STUDENT'
                          ? 'Student registration only'
                          : 'Count me in'}
                <ArrowRight size={15} />
              </button>
              <p className='mt-3 text-center text-[10px] leading-5 text-muted'>
                Plans change. You can cancel before the event starts.
              </p>
            </>
          )}
        </aside>
      </div>
      {cancel && (
        <Modal title='Can’t make it?' onClose={() => setCancel(false)}>
          <p className='text-sm leading-6 text-muted'>
            Cancel your registration for {event.title}? Your spot will become
            available to another student.
          </p>
          <div className='mt-6 flex justify-end gap-3'>
            <button className='btn' onClick={() => setCancel(false)}>
              Keep my spot
            </button>
            <button
              className='btn btn-danger'
              disabled={busy}
              onClick={() => book(true)}
            >
              {busy ? 'Cancelling…' : 'Cancel registration'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Detail({ icon: Icon, label, value }) {
  return (
    <div className='flex gap-3'>
      <Icon size={17} className='mt-0.5 shrink-0 text-muted' />
      <div>
        <p className='mb-1 text-[10px] uppercase tracking-wider text-muted'>
          {label}
        </p>
        <p className='text-sm leading-5'>{value}</p>
      </div>
    </div>
  );
}
export function Registrations() {
  const { data, loading, error } = useResource('/registrations/me');
  const [tab, setTab] = useState('Upcoming');
  const filtered = data?.filter((r) =>
    tab === 'Cancelled'
      ? r.status === 'CANCELLED'
      : r.status !== 'CANCELLED' &&
        (tab === 'Upcoming'
          ? new Date(r.event.endAt) >= new Date()
          : new Date(r.event.endAt) < new Date())
  );
  return (
    <>
      <PageHeader
        title='Your next good moments'
        eyebrow='My registrations'
        subtitle='All your plans, in one place.'
      >
        <Link to='/' className='btn'>
          Discover more <ArrowUpRight size={15} />
        </Link>
      </PageHeader>
      <div className='mb-6 flex gap-2'>
        {['Upcoming', 'Past', 'Cancelled'].map((t) => (
          <button
            className={`category-pill ${tab === t ? 'selected' : ''}`}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : !filtered?.length ? (
        <Empty
          title={
            tab === 'Upcoming'
              ? 'Your calendar has room for something good'
              : `No ${tab.toLowerCase()} registrations`
          }
          message='Find an event that feels like you, and save yourself a spot.'
          action={
            <Link className='btn btn-primary' to='/'>
              Explore events <ArrowRight size={15} />
            </Link>
          }
        />
      ) : (
        <div className='space-y-4'>
          {filtered.map((r) => (
            <div
              className='panel flex flex-wrap items-center gap-5 p-5'
              key={r.id}
            >
              <div className='flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-[#edf2e4] text-forest'>
                <span className='text-[10px] font-semibold uppercase tracking-wider'>
                  {date(r.event.startAt, { month: 'short' })}
                </span>
                <span className='text-3xl font-semibold'>
                  {date(r.event.startAt, { day: '2-digit' })}
                </span>
              </div>
              <div className='min-w-50 flex-1'>
                <div className='mb-2 flex items-center gap-3'>
                  <span className='text-[11px] text-muted'>
                    {r.event.category}
                  </span>
                  <Badge status={r.status} />
                </div>
                <Link
                  to={`/discover/${r.eventId}`}
                  className='text-lg font-semibold hover:text-forest'
                >
                  {r.event.title}
                </Link>
                <p className='mt-2 flex flex-wrap items-center gap-3 text-xs text-muted'>
                  <span className='flex items-center gap-1.5'>
                    <Clock3 size={13} />
                    {time(r.event.startAt)}
                  </span>
                  <span className='flex items-center gap-1.5'>
                    <MapPin size={13} />
                    {r.event.location}
                  </span>
                </p>
              </div>
              <Link className='btn' to={`/discover/${r.eventId}`}>
                View event <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
