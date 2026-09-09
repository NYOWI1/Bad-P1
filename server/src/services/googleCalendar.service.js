import { createHash } from 'node:crypto';
import { db } from '../config/db.js';

export const calendarConfigured = () =>
  [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_CALENDAR_ID'
  ].every((k) => !!process.env[k]);
async function calendarRequest(path, method, body) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  if (!tokenResponse.ok)
    throw new Error('Google Calendar authorization failed.');
  const { access_token } = await tokenResponse.json();
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID)}/events${path}`,
    {
      method,
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    }
  );
  if (method === 'DELETE' && [404, 410].includes(response.status)) return null;
  if (!response.ok)
    throw Object.assign(new Error('Google Calendar request failed.'), {
      googleStatus: response.status
    });
  return response.status === 204 ? null : response.json();
}
const payload = (e) => ({
  summary: e.title,
  description: e.description,
  location: e.location,
  start: { dateTime: new Date(e.startAt).toISOString() },
  end: { dateTime: new Date(e.endAt).toISOString() }
});
export async function createCalendarEvent(event) {
  const id = createHash('sha256').update(event.id).digest('hex');
  try {
    return await calendarRequest('', 'POST', { id, ...payload(event) });
  } catch (error) {
    if (error.googleStatus === 409)
      return calendarRequest(`/${id}`, 'PUT', payload(event));
    throw error;
  }
}
export const updateCalendarEvent = (e) =>
  calendarRequest(
    `/${encodeURIComponent(e.googleCalendarId)}`,
    'PUT',
    payload(e)
  );
export const cancelCalendarEvent = (e) =>
  e.googleCalendarId
    ? calendarRequest(`/${encodeURIComponent(e.googleCalendarId)}`, 'DELETE')
    : null;
export async function syncCalendar(event) {
  if (!calendarConfigured())
    return db.event.update({
      where: { id: event.id },
      data: { calendarSyncStatus: 'NOT_CONFIGURED' }
    });
  try {
    const result =
      event.status === 'CANCELLED'
        ? await cancelCalendarEvent(event)
        : event.googleCalendarId
          ? await updateCalendarEvent(event)
          : await createCalendarEvent(event);
    return db.event.update({
      where: { id: event.id },
      data: {
        googleCalendarId: result?.id || event.googleCalendarId,
        calendarSyncStatus: 'SYNCED'
      }
    });
  } catch {
    return db.event.update({
      where: { id: event.id },
      data: { calendarSyncStatus: 'ERROR' }
    });
  }
}
