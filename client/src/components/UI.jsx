import { useEffect, useRef } from 'react';
import {
  CalendarDays,
  MapPin,
  ArrowUpRight,
  Users,
  X,
  LoaderCircle,
  SearchX,
  Check,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
export const categories = [
  'Technology',
  'Arts & Culture',
  'Career',
  'Wellness',
  'Community',
  'Academic'
];
export const themes = {
  Technology: {
    bg: '#e5edce',
    ink: '#384b27',
    label: 'MAKE YOUR NEXT BIG THING',
    title: ['Ideas in.', 'Impact out.'],
    tag: 'THE CAMPUS BUILD SERIES',
    code: '01'
  },
  'Arts & Culture': {
    bg: '#ece3f3',
    ink: '#6a487f',
    label: 'A SPACE FOR YOUR PERSPECTIVE',
    title: ['A little art.', 'A lot of soul.'],
    tag: 'ART, CULTURE & EVERYTHING IN BETWEEN',
    code: '02'
  },
  Career: {
    bg: '#f8e7d6',
    ink: '#9a603a',
    label: 'YOUR FUTURE IS IN GOOD COMPANY',
    title: ['Meet people.', 'Find possibility.'],
    tag: 'MAKE YOUR NEXT MOVE',
    code: '03'
  },
  Wellness: {
    bg: '#dfeded',
    ink: '#397577',
    label: 'MAKE ROOM FOR YOURSELF',
    title: ['Breathe in.', 'Begin again.'],
    tag: 'A MOMENT OF BALANCE',
    code: '04'
  },
  Community: {
    bg: '#f1e7cc',
    ink: '#8a7034',
    label: 'YOU BELONG HERE',
    title: ['New faces.', 'Good company.'],
    tag: 'BETTER WHEN WE GET TOGETHER',
    code: '05'
  },
  Academic: {
    bg: '#e0e7f2',
    ink: '#456187',
    label: 'FOLLOW YOUR CURIOSITY',
    title: ['Big questions.', 'Fresh thinking.'],
    tag: 'KEEP YOUR MIND OPEN',
    code: '06'
  }
};
export const date = (value, options = { month: 'short', day: 'numeric' }) =>
  new Date(value).toLocaleDateString('en-US', options);
export const time = (value) =>
  new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
export function IconButton({ label, children, ...props }) {
  return (
    <button
      className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink'
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
export function Badge({ status }) {
  const colors = {
    PUBLISHED: 'bg-[#edf3e6] text-forest',
    REGISTERED: 'bg-[#edf3e6] text-forest',
    ATTENDED: 'bg-blue-50 text-blue-700',
    CLOSED: 'bg-slate-100 text-slate-600',
    CANCELLED: 'bg-red-50 text-red-600',
    ABSENT: 'bg-orange-50 text-orange-700',
    DRAFT: 'bg-amber-50 text-amber-700'
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}
    >
      <span className='h-1.5 w-1.5 rounded-full bg-current' />
      {status?.toLowerCase().replaceAll('_', ' ')}
    </span>
  );
}
export function Loading() {
  return (
    <div
      className='flex min-h-64 items-center justify-center gap-3 text-muted'
      role='status'
    >
      <LoaderCircle className='animate-spin' size={20} /> Loading campus life…
    </div>
  );
}
export function Empty({ title = 'Nothing here just yet', message, action }) {
  return (
    <div className='panel flex flex-col items-center px-6 py-16 text-center'>
      <div className='mb-5 rounded-full bg-[#eff3e9] p-4 text-forest'>
        <SearchX size={25} />
      </div>
      <h3 className='text-xl font-semibold'>{title}</h3>
      <p className='mt-2 max-w-md text-sm text-muted'>{message}</p>
      {action && <div className='mt-5'>{action}</div>}
    </div>
  );
}
export function ErrorMessage({ message }) {
  return (
    <div
      role='alert'
      className='my-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800'
    >
      <AlertCircle size={18} className='shrink-0' />
      {message}
    </div>
  );
}
export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className='mb-7 flex flex-wrap items-end justify-between gap-4'>
      <div>
        {eyebrow && <p className='eyebrow mb-2 text-muted'>{eyebrow}</p>}
        <h1 className='page-title'>{title}</h1>
        {subtitle && <p className='mt-2 text-sm text-muted'>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function Poster({ event, large = false }) {
  const theme = themes[event.category] || themes.Technology;
  return (
    <div
      className={`poster ${large ? 'h-64! sm:h-80! px-8! py-7!' : ''}`}
      style={{ backgroundColor: theme.bg, color: theme.ink }}
    >
      <div className='relative z-10 flex items-start justify-between gap-2'>
        <span className='text-[9px] font-bold tracking-[.13em]'>
          {theme.label}
        </span>
        <ArrowUpRight size={large ? 24 : 19} />
      </div>
      <div
        className={`relative z-10 font-semibold leading-[1.05] tracking-tighter ${large ? 'text-5xl sm:text-6xl' : 'text-[31px]'}`}
      >
        {theme.title.map((t) => (
          <div key={t}>{t}</div>
        ))}
      </div>
      <div className='relative z-10 flex items-end justify-between'>
        <span className='max-w-50 text-[8px] font-semibold tracking-[.12em]'>
          {theme.tag}
        </span>
        <span className='text-[10px]'>C / {theme.code}</span>
      </div>
      <div className='poster-orbit' />
    </div>
  );
}
export function EventCard({ event, registered }) {
  const seats = event.capacity - event._count.registrations;
  return (
    <Link
      to={`/discover/${event.id}`}
      className='group overflow-hidden rounded-xl border border-line bg-white transition duration-200 hover:-translate-y-1 hover:border-[#c3cfc0] hover:shadow-lg hover:shadow-forest/5'
    >
      <Poster event={event} />
      <div className='p-5'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <span className='rounded bg-[#f2f5ee] px-2 py-1 text-[10px] font-medium text-forest'>
            {event.category}
          </span>
          {registered ? (
            <span className='flex items-center gap-1 text-[10px] font-medium text-forest'>
              <Check size={12} /> You’re going
            </span>
          ) : (
            <span className='text-[11px] text-muted'>Free entry</span>
          )}
        </div>
        <h3 className='mb-4 min-h-12 text-[18px] font-semibold leading-6 group-hover:text-forest'>
          {event.title}
        </h3>
        <div className='space-y-2 text-xs text-[#7a827c]'>
          <p className='flex items-center gap-2'>
            <CalendarDays size={13} />
            <span>
              {date(event.startAt, {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
              <span className='mx-1.5 text-[#ced3cf]'>·</span>
              {time(event.startAt)}
            </span>
          </p>
          <p className='flex items-center gap-2'>
            <MapPin size={13} className='shrink-0' />
            <span className='truncate'>{event.location}</span>
          </p>
        </div>
        <div className='mt-5 flex items-center justify-between border-t border-line pt-3.5'>
          <span className='flex items-center gap-1.5 text-[11px] text-muted'>
            <Users size={13} />
            {seats > 0 ? `${seats} spots left` : 'Fully booked'}
          </span>
          <span className='flex items-center gap-1.5 text-xs font-medium text-forest'>
            View event <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className='fixed inset-0 m-auto max-h-[90vh] w-[min(560px,calc(100%-32px))] overflow-auto rounded-2xl border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-black/35'
    >
      <div className='flex items-center justify-between border-b border-line p-6'>
        <h2 className='text-xl font-semibold'>{title}</h2>
        <IconButton label='Close dialog' onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <div className='p-6'>{children}</div>
    </dialog>
  );
}
export function Field({ label, children, ...props }) {
  return (
    <label className='block'>
      <span className='label'>{label}</span>
      {children || <input className='input' {...props} />}
    </label>
  );
}
