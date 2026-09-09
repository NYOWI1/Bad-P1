import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  ArrowUpRight,
  SlidersHorizontal,
  LayoutGrid,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';
import { useApp, useResource } from '../context/AppContext';
import {
  categories,
  themes,
  EventCard,
  Loading,
  ErrorMessage,
  Empty,
  date,
  time,
  PageHeader
} from '../components/UI';

export default function Discover({ calendar = false }) {
  const { user } = useApp();
  const { data: events, loading, error } = useResource('/events');
  const { data: registrations } = useResource(
    user?.role === 'STUDENT' ? '/registrations/me' : null
  );
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false),
    [month, setMonth] = useState(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
  const q = params.get('q') || '',
    category = params.get('category') || 'All events',
    period = params.get('period') || 'upcoming',
    available = params.get('available') === 'true';
  const update = (key, value) =>
    setParams((p) => {
      value ? p.set(key, value) : p.delete(key);
      return p;
    });
  const myEvents = new Set(
    registrations?.filter((r) => r.status !== 'CANCELLED').map((r) => r.eventId)
  );
  const filtered = useMemo(
    () =>
      (events || []).filter((e) => {
        const starts = new Date(e.startAt),
          now = new Date(),
          limit = new Date(now.getTime() + 7 * 86400000);
        return (
          (category === 'All events' || e.category === category) &&
          `${e.title} ${e.description} ${e.location}`
            .toLowerCase()
            .includes(q.toLowerCase()) &&
          (period === 'all' || starts >= now) &&
          (period !== 'week' || starts <= limit) &&
          (period !== 'month' ||
            (starts.getMonth() === now.getMonth() &&
              starts.getFullYear() === now.getFullYear())) &&
          (!available || e.capacity > e._count.registrations)
        );
      }),
    [events, q, category, period, available]
  );
  const featured = events?.find((e) => new Date(e.startAt) > new Date());
  return (
    <>
      <PageHeader
        title={calendar ? 'Campus calendar' : 'Discover events'}
        subtitle={
          calendar
            ? 'A little planning. A lot to look forward to.'
            : 'Find your people. Try something new. Make it a campus to remember.'
        }
      >
        {user && (
          <Link
            to={user.role === 'STUDENT' ? '/registrations' : '/create'}
            className='btn'
          >
            {user.role === 'STUDENT' ? (
              <>
                <TicketIcon /> My registrations
              </>
            ) : (
              <>
                Create an event <ArrowUpRight size={15} />
              </>
            )}
          </Link>
        )}
      </PageHeader>
      {!calendar && (
        <section className='relative mb-8 flex min-h-61.5 overflow-hidden rounded-2xl bg-forest text-white'>
          <div className='relative z-10 flex-1 px-7 py-7 sm:px-9 sm:py-8'>
            <div className='mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-medium tracking-wide text-[#e0eecf]'>
              <Sparkles size={11} /> A LITTLE MORE CAMPUS LIFE
            </div>
            <h2 className='text-[34px] font-medium leading-[1.08] tracking-[-.045em] sm:text-[42px]'>
              Good things happen
              <br />
              when you show up<span className='text-[#cde6a6]'>.</span>
            </h2>
            <p className='mt-4 max-w-sm text-xs leading-5 text-[#c0d2c4]'>
              Big ideas, shared interests, and unexpected connections.
              <br className='hidden sm:block' /> There’s something here for you.
            </p>
          </div>
          <div className='hero-pattern relative hidden w-[38%] items-center justify-center border-l border-white/10 px-9 md:flex'>
            {featured && (
              <Link
                to={`/discover/${featured.id}`}
                className='relative w-full max-w-67.5 -rotate-3 rounded-xl border border-white/25 bg-[#f0f2df] p-5 text-forest shadow-lg transition hover:rotate-0'
              >
                <div className='flex items-center justify-between'>
                  <span className='eyebrow text-[9px]'>On the horizon</span>
                  <ArrowUpRight size={18} />
                </div>
                <div className='mt-4 flex items-end gap-3'>
                  <span className='text-5xl font-medium tracking-[-.07em]'>
                    {date(featured.startAt, { day: '2-digit' })}
                  </span>
                  <span className='mb-1 text-xs uppercase'>
                    {date(featured.startAt, { month: 'short' })}
                    <br />
                    {date(featured.startAt, { weekday: 'short' })}
                  </span>
                </div>
                <h3 className='mt-3 text-xl font-semibold leading-tight'>
                  {featured.title}
                </h3>
                <div className='mt-4 flex items-center justify-between border-t border-forest/15 pt-3 text-[10px]'>
                  <span>{time(featured.startAt)} · Free entry</span>
                  <span className='rounded-full bg-forest p-1.5 text-white'>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <h2 className='text-xl font-semibold'>
            {calendar ? 'What’s on' : 'Find your next thing'}
          </h2>
          {events && (
            <span className='rounded-full bg-[#eaf0e3] px-2 py-0.5 text-[10px] font-medium text-forest'>
              {events.filter((e) => new Date(e.startAt) > new Date()).length}{' '}
              upcoming
            </span>
          )}
        </div>
        <div className='flex rounded-lg border border-line bg-white p-1'>
          <Link
            to={`/${params.size ? `?${params}` : ''}`}
            aria-label='Grid view'
            className={`rounded p-1.5 ${!calendar ? 'bg-[#edf1e6] text-forest' : 'text-muted'}`}
          >
            <LayoutGrid size={16} />
          </Link>
          <Link
            to={`/calendar${params.size ? `?${params}` : ''}`}
            aria-label='Calendar view'
            className={`rounded p-1.5 ${calendar ? 'bg-[#edf1e6] text-forest' : 'text-muted'}`}
          >
            <CalendarDays size={16} />
          </Link>
        </div>
      </div>
      <div className='mb-4 flex flex-wrap gap-3'>
        <label className='relative min-w-50 flex-1'>
          <Search size={16} className='absolute left-3.5 top-3.5 text-muted' />
          <input
            className='input pl-10!'
            aria-label='Search events'
            placeholder='Search events, interests, or something new…'
            value={q}
            onChange={(e) => update('q', e.target.value)}
          />
        </label>
        <select
          className='input w-auto! min-w-36.25!'
          aria-label='Date range'
          value={period}
          onChange={(e) => update('period', e.target.value)}
        >
          <option value='upcoming'>Upcoming events</option>
          <option value='week'>This week</option>
          <option value='month'>This month</option>
          <option value='all'>All dates</option>
        </select>
        <button
          className={`btn ${filtersOpen || available ? 'border-forest! text-forest' : ''}`}
          onClick={() => setFiltersOpen(!filtersOpen)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={15} /> Filters
          {available && <span className='h-1.5 w-1.5 rounded-full bg-forest' />}
        </button>
      </div>
      {filtersOpen && (
        <div className='panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4'>
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              className='accent-forest'
              checked={available}
              onChange={(e) =>
                update('available', e.target.checked ? 'true' : '')
              }
            />{' '}
            Only show events with available spots
          </label>
          <button
            className='text-xs text-muted underline'
            onClick={() => setParams({})}
          >
            Reset filters
          </button>
        </div>
      )}
      <div className='mb-6 flex gap-2 overflow-x-auto pb-1'>
        {['All events', ...categories].map((c) => (
          <button
            key={c}
            className={`category-pill ${category === c ? 'selected' : ''}`}
            onClick={() => update('category', c === 'All events' ? '' : c)}
          >
            {c === 'All events' && <LayoutGrid size={12} />} {c}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : calendar ? (
        <Calendar events={filtered} month={month} setMonth={setMonth} />
      ) : filtered.length ? (
        <>
          <div className='mb-4 flex justify-between text-[11px] text-muted'>
            <span>
              Showing {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            </span>
            <span>Sorted by soonest first</span>
          </div>
          <div className='grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'>
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                registered={myEvents.has(event.id)}
              />
            ))}
          </div>
          <div className='py-9 text-center text-xs text-muted'>
            You’re all caught up. Your next great moment is one event away.
          </div>
        </>
      ) : (
        <Empty
          title='No events match just yet'
          message='Try another interest or a wider date range. There’s always something new around the corner.'
          action={
            <button className='btn' onClick={() => setParams({})}>
              Clear filters
            </button>
          }
        />
      )}
    </>
  );
}
function TicketIcon() {
  return <CalendarDays size={15} />;
}
function Calendar({ events, month, setMonth }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1),
    offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <div className='panel overflow-hidden'>
      <div className='flex items-center justify-between p-5'>
        <h3 className='text-xl font-semibold'>
          {date(month, { month: 'long', year: 'numeric' })}
        </h3>
        <div className='flex gap-2'>
          <button
            className='btn p-2!'
            aria-label='Previous month'
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className='btn py-1!'
            onClick={() =>
              setMonth(
                new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              )
            }
          >
            Today
          </button>
          <button
            className='btn p-2!'
            aria-label='Next month'
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className='overflow-x-auto'>
        <div className='min-w-160'>
          <div className='grid grid-cols-7 border-y border-line bg-[#fafbf8]'>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className='p-3 text-center text-xs text-muted'>
                {d}
              </div>
            ))}
          </div>
          <div className='grid grid-cols-7'>
            {Array.from(
              { length: Math.ceil((offset + days) / 7) * 7 },
              (_, i) => {
                const day = i - offset + 1,
                  valid = day > 0 && day <= days;
                const current = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  day
                );
                const dayEvents = valid
                  ? events.filter(
                      (e) =>
                        new Date(e.startAt).toDateString() ===
                        current.toDateString()
                    )
                  : [];
                return (
                  <div
                    key={i}
                    className={`min-h-31.5 border-b border-r border-line p-2 ${!valid ? 'bg-[#fafbf9]' : ''}`}
                  >
                    {valid && (
                      <>
                        <span
                          className={`flex h-6 w-6 items-center justify-center text-xs ${current.toDateString() === new Date().toDateString() ? 'rounded-full bg-forest text-white' : 'text-muted'}`}
                        >
                          {day}
                        </span>
                        {dayEvents.map((e) => (
                          <Link
                            key={e.id}
                            to={`/discover/${e.id}`}
                            className='mt-1.5 block rounded p-1.5 text-[10px] leading-4'
                            style={{
                              background: themes[e.category]?.bg,
                              color: themes[e.category]?.ink
                            }}
                          >
                            <span className='block font-semibold'>
                              {time(e.startAt)}
                            </span>
                            {e.title}
                          </Link>
                        ))}
                      </>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
