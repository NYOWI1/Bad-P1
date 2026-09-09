import { z } from 'zod';
import { fail } from '../middleware/errorHandler.js';
export const assistLinkConfigured = () =>
  !!(process.env.ASSISTLINK_URL && process.env.ASSISTLINK_API_KEY);
export async function getAssistLinkRegistrations(externalEventId) {
  if (!assistLinkConfigured()) fail(503, 'AssistLink has not been configured.');
  const url = new URL(
    `${process.env.ASSISTLINK_URL.replace(/\/$/, '')}/api/peer/v1/events/${encodeURIComponent(externalEventId)}/registrations`
  );
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    fail(503, 'AssistLink must use HTTPS in production.');
  let response;
  try {
    response = await fetch(url, {
      headers: { 'x-api-key': process.env.ASSISTLINK_API_KEY },
      signal: AbortSignal.timeout(10000),
      redirect: 'error'
    });
  } catch {
    fail(502, 'AssistLink could not be reached.');
  }
  if (!response.ok) fail(502, 'AssistLink could not return registrations.');
  const body = await response.json();
  return z
    .array(
      z.object({
        name: z.string(),
        email: z.email(),
        department: z.string().optional(),
        registeredAt: z.string().optional()
      })
    )
    .parse(Array.isArray(body) ? body : body.registrations);
}
