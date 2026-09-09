import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import { rateLimit } from 'express-rate-limit';
import { db, transaction } from '../config/db.js';
import { fail } from '../middleware/errorHandler.js';
import {
  auth,
  optionalAuth,
  requireRole,
  owns,
  issueToken,
  userSelect,
  peerAuth,
  hashKey
} from '../middleware/auth.js';
import {
  eventInclude,
  getEvent,
  visibleTo,
  writeEvent,
  registerStudent,
  activeRegistration
} from '../services/events.service.js';
import {
  calendarConfigured,
  syncCalendar
} from '../services/googleCalendar.service.js';
import {
  assistLinkConfigured,
  getAssistLinkRegistrations
} from '../services/assistLink.service.js';

export const api = Router();
const managers = requireRole('ADMIN', 'ORGANIZER');
const admin = requireRole('ADMIN');
const demoEnabled = () =>
  process.env.NODE_ENV === 'development' && process.env.DEMO_AUTH === 'true';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
const eventSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(20).max(10000),
    category: z.enum([
      'Technology',
      'Arts & Culture',
      'Career',
      'Wellness',
      'Community',
      'Academic'
    ]),
    location: z.string().trim().min(2).max(200),
    capacity: z.number().int().min(1).max(10000),
    startAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
    endAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
    registrationClosesAt: z.iso
      .datetime({ offset: true })
      .transform((v) => new Date(v))
      .nullable()
      .optional(),
    departmentId: z.string().min(1),
    roomId: z.string().min(1).nullable().optional(),
    externalEventId: z.string().max(100).nullable().optional()
  })
  .strict();
const roomSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    building: z.string().trim().min(2).max(100),
    capacity: z.number().int().min(1).max(10000)
  })
  .strict();
const departmentSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    code: z.string().trim().min(2).max(12)
  })
  .strict();

api.get('/health', async (req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});
api.get('/config', (req, res) =>
  res.json({
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      tenantId: process.env.MICROSOFT_TENANT_ID || '',
      scope: process.env.MICROSOFT_API_SCOPE || ''
    }
  })
);
api.post('/auth/demo', authLimiter, async (req, res) => {
  if (!demoEnabled()) fail(404, 'Not found.');
  const { role } = z
    .object({ role: z.enum(['STUDENT', 'ORGANIZER', 'ADMIN']) })
    .parse(req.body);
  const user = await db.user.findUnique({
    where: { email: `${role.toLowerCase()}@demo.campus.local` },
    select: userSelect
  });
  if (!user) fail(503, 'Run the development seed first.');
  res.json({ token: issueToken(user), user });
});
let microsoftKeys;
api.post('/auth/microsoft', authLimiter, async (req, res) => {
  const { accessToken } = z
    .object({ accessToken: z.string().min(1).max(20000) })
    .parse(req.body);
  const tenant = process.env.MICROSOFT_TENANT_ID;
  const apiClientId = process.env.MICROSOFT_API_CLIENT_ID;
  if (!tenant || !apiClientId)
    fail(503, 'University Microsoft sign-in is not configured yet.');
  const audiences = apiClientId.startsWith('api://')
    ? [apiClientId]
    : [apiClientId, `api://${apiClientId}`];
  const issuers = [
    `https://login.microsoftonline.com/${tenant}/v2.0`,
    `https://sts.windows.net/${tenant}/`
  ];
  microsoftKeys ||= createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`)
  );
  let payload;
  try {
    ({ payload } = await jwtVerify(accessToken, microsoftKeys, {
      issuer: issuers,
      audience: audiences,
      algorithms: ['RS256']
    }));
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      let claims = {};
      try {
        const decoded = decodeJwt(accessToken);
        claims = {
          iss: decoded.iss,
          aud: decoded.aud,
          tid: decoded.tid,
          scp: decoded.scp,
          azp: decoded.azp,
          appid: decoded.appid
        };
      } catch {}
      console.warn('Microsoft JWT verification failed:', {
        code: error.code,
        claim: error.claim,
        reason: error.reason,
        expectedAudience: audiences,
        expectedIssuer: issuers,
        claims
      });
    }
    fail(401, 'Microsoft identity could not be verified.');
  }
  const authorizedClient = payload.azp || payload.appid;
  if (
    payload.tid !== tenant ||
    !payload.oid ||
    !payload.scp?.split(' ').includes('access_as_user') ||
    (process.env.MICROSOFT_CLIENT_ID &&
      authorizedClient !== process.env.MICROSOFT_CLIENT_ID)
  ) {
    if (process.env.NODE_ENV === 'development')
      console.warn('Microsoft claim validation failed:', {
        tid: payload.tid,
        hasOid: !!payload.oid,
        scp: payload.scp,
        azp: payload.azp,
        appid: payload.appid,
        aud: payload.aud
      });
    fail(401, 'Invalid university identity or API scope.');
  }
  const emailClaim =
    payload.preferred_username ||
    payload.email ||
    payload.upn ||
    payload.unique_name;
  if (!emailClaim) {
    if (process.env.NODE_ENV === 'development')
      console.warn('Microsoft token did not include an email claim:', {
        availableClaims: Object.keys(payload).sort()
      });
    fail(401, 'Microsoft identity did not include a university email address.');
  }
  const email = z.email().parse(emailClaim).toLowerCase();
  const user = await transaction(async (tx) => {
    const byIdentity = await tx.user.findUnique({
      where: { adObjectId: payload.oid }
    });
    if (byIdentity)
      return tx.user.update({
        where: { id: byIdentity.id },
        data: { name: payload.name || byIdentity.name },
        select: userSelect
      });
    const byEmail = await tx.user.findUnique({ where: { email } });
    if (byEmail?.adObjectId)
      fail(409, 'This email belongs to another Microsoft identity.');
    if (byEmail)
      return tx.user.update({
        where: { id: byEmail.id },
        data: { adObjectId: payload.oid, name: payload.name || byEmail.name },
        select: userSelect
      });
    return tx.user.upsert({
      where: { email },
      create: { email, adObjectId: payload.oid, name: payload.name || email },
      update: { adObjectId: payload.oid },
      select: userSelect
    });
  });
  res.json({ token: issueToken(user), user });
});

const peer = Router();
peer.use(
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false
  })
);
const peerFields = {
  id: true,
  title: true,
  description: true,
  category: true,
  location: true,
  capacity: true,
  startAt: true,
  endAt: true
};
peer.get('/events', peerAuth('assistlink:events:read'), async (req, res) =>
  res.json({
    events: await db.event.findMany({
      where: { status: 'PUBLISHED' },
      select: peerFields,
      orderBy: { startAt: 'asc' },
      take: 200
    })
  })
);
peer.get(
  '/events/:id',
  peerAuth('assistlink:events:read'),
  async (req, res) => {
    const event = await db.event.findFirst({
      where: { id: req.params.id, status: 'PUBLISHED' },
      select: peerFields
    });
    if (!event) fail(404, 'Event not found.');
    res.json(event);
  }
);
peer.post(
  '/events/:id/registrations',
  peerAuth('assistlink:events:register'),
  async (req, res) => {
    const input = z
      .object({
        externalStudentId: z.string().min(1).max(100),
        name: z.string().trim().min(2).max(100),
        email: z.email().transform((s) => s.toLowerCase()),
        department: z.string().max(100).optional()
      })
      .strict()
      .parse(req.body);
    const registration = await registerStudent(req.params.id, null, input);
    res.status(201).json({
      id: registration.id,
      eventId: registration.eventId,
      status: registration.status,
      registeredAt: registration.registeredAt
    });
  }
);
api.use('/peer/v1', peer);
api.use(optionalAuth);
api.get('/users/me', auth, (req, res) => res.json(req.user));
api.get('/events', async (req, res) => {
  const manage = req.query.manage === 'true';
  if (manage && !['ADMIN', 'ORGANIZER'].includes(req.user?.role))
    fail(403, 'Event management is restricted to organizers.');
  const where = manage
    ? req.user.role === 'ADMIN'
      ? {}
      : { organizerId: req.user.id }
    : { status: 'PUBLISHED' };
  if (typeof req.query.q === 'string' && req.query.q.trim())
    where.OR = ['title', 'description', 'location'].map((k) => ({
      [k]: { contains: req.query.q.trim().slice(0, 200), mode: 'insensitive' }
    }));
  if (typeof req.query.category === 'string')
    where.category = req.query.category;
  const events = await db.event.findMany({
    where,
    include: eventInclude,
    orderBy: { startAt: 'asc' },
    take: 500
  });
  res.json(events);
});
api.get('/events/:id', async (req, res) => {
  const event = await getEvent(req.params.id);
  visibleTo(event, req.user);
  res.json(event);
});
api.post('/events', managers, async (req, res) => {
  const event = await writeEvent(req.user, null, eventSchema.parse(req.body));
  res.status(201).json(await getEvent(event.id));
});
api.patch('/events/:id', managers, async (req, res) => {
  let event = await writeEvent(
    req.user,
    req.params.id,
    eventSchema.partial().parse(req.body)
  );
  if (event.status === 'PUBLISHED') await syncCalendar(event);
  res.json(await getEvent(event.id));
});
async function changeStatus(req, status) {
  const event = await transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${req.params.id} FOR UPDATE`;
    const current = await tx.event.findUnique({ where: { id: req.params.id } });
    if (!current) fail(404, 'Event not found.');
    owns(req.user, current);
    const allowed = {
      PUBLISHED: ['DRAFT'],
      CLOSED: ['PUBLISHED'],
      CANCELLED: ['DRAFT', 'PUBLISHED', 'CLOSED']
    };
    if (!allowed[status].includes(current.status))
      fail(409, 'This status change is not allowed.');
    if (status === 'PUBLISHED' && current.startAt <= new Date())
      fail(409, 'Cannot publish an event that has already started.');
    if (status === 'CANCELLED') {
      await tx.eventRoomBooking.deleteMany({ where: { eventId: current.id } });
      await tx.eventRegistration.updateMany({
        where: { eventId: current.id, status: 'REGISTERED' },
        data: { status: 'CANCELLED' }
      });
    }
    return tx.event.update({ where: { id: current.id }, data: { status } });
  });
  if (
    status === 'PUBLISHED' ||
    (status === 'CANCELLED' && event.googleCalendarId)
  )
    await syncCalendar(event);
  return getEvent(event.id);
}
api.post('/events/:id/publish', managers, async (req, res) =>
  res.json(await changeStatus(req, 'PUBLISHED'))
);
api.post('/events/:id/close', managers, async (req, res) =>
  res.json(await changeStatus(req, 'CLOSED'))
);
api.delete('/events/:id', managers, async (req, res) => {
  const current = await db.event.findUnique({ where: { id: req.params.id } });
  if (!current) fail(404, 'Event not found.');
  owns(req.user, current);
  if (current.status !== 'CANCELLED')
    return res.json(await changeStatus(req, 'CANCELLED'));
  if (req.user.role !== 'ADMIN')
    fail(403, 'Only administrators can delete cancelled events.');
  await transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${req.params.id} FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id: req.params.id } });
    if (!event) fail(404, 'Event not found.');
    if (event.status !== 'CANCELLED')
      fail(409, 'Cancel this event before deleting it.');
    await tx.eventRegistration.deleteMany({ where: { eventId: event.id } });
    await tx.eventRoomBooking.deleteMany({ where: { eventId: event.id } });
    await tx.event.delete({ where: { id: event.id } });
  });
  res.status(204).end();
});
api.post('/events/:id/calendar-sync', managers, async (req, res) => {
  const event = await getEvent(req.params.id);
  owns(req.user, event);
  if (event.status === 'DRAFT') fail(409, 'Publish this event first.');
  await syncCalendar(event);
  res.json(await getEvent(event.id));
});
api.post(
  '/events/:id/registrations',
  requireRole('STUDENT'),
  async (req, res) =>
    res.status(201).json(await registerStudent(req.params.id, req.user.id))
);
api.delete(
  '/events/:id/registrations/me',
  requireRole('STUDENT'),
  async (req, res) => {
    const registration = await transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${req.params.id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id: req.params.id } });
      if (!event) fail(404, 'Event not found.');
      if (event.startAt <= new Date())
        fail(409, 'This event has already started.');
      const existing = await tx.eventRegistration.findUnique({
        where: {
          eventId_studentId: { eventId: event.id, studentId: req.user.id }
        }
      });
      if (!existing || existing.status !== 'REGISTERED')
        fail(409, 'There is no active registration to cancel.');
      return tx.eventRegistration.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED' }
      });
    });
    res.json(registration);
  }
);
api.get('/registrations/me', requireRole('STUDENT'), async (req, res) =>
  res.json(
    await db.eventRegistration.findMany({
      where: { studentId: req.user.id },
      include: { event: { include: eventInclude } },
      orderBy: { registeredAt: 'desc' }
    })
  )
);
api.get('/events/:id/registrations', managers, async (req, res) => {
  const event = await getEvent(req.params.id);
  owns(req.user, event);
  res.json(
    await db.eventRegistration.findMany({
      where: { eventId: event.id },
      include: {
        student: {
          select: { id: true, name: true, email: true, department: true }
        }
      },
      orderBy: { registeredAt: 'desc' }
    })
  );
});
api.patch('/registrations/:id', managers, async (req, res) => {
  const { status } = z
    .object({ status: z.enum(['ATTENDED', 'ABSENT', 'REGISTERED']) })
    .strict()
    .parse(req.body);
  res.json(
    await transaction(async (tx) => {
      const registration = await tx.eventRegistration.findUnique({
        where: { id: req.params.id },
        include: { event: true }
      });
      if (!registration) fail(404, 'Registration not found.');
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${registration.eventId} FOR UPDATE`;
      owns(req.user, registration.event);
      if (
        registration.status === 'CANCELLED' ||
        registration.event.status === 'CANCELLED'
      )
        fail(409, 'Cancelled registrations cannot be marked.');
      if (status !== 'REGISTERED' && registration.event.startAt > new Date())
        fail(409, 'Attendance can be marked once the event starts.');
      return tx.eventRegistration.update({
        where: { id: registration.id },
        data: { status }
      });
    })
  );
});
api.get('/events/:id/assistlink-registrations', managers, async (req, res) => {
  const event = await getEvent(req.params.id);
  owns(req.user, event);
  if (!event.externalEventId)
    fail(400, 'Set an AssistLink event ID in the event editor first.');
  res.json(await getAssistLinkRegistrations(event.externalEventId));
});

api.get('/rooms', auth, async (req, res) =>
  res.json(
    await db.room.findMany({
      include: { _count: { select: { bookings: true } } },
      orderBy: { name: 'asc' }
    })
  )
);
api.post('/rooms', admin, async (req, res) =>
  res
    .status(201)
    .json(await db.room.create({ data: roomSchema.parse(req.body) }))
);
api.patch('/rooms/:id', admin, async (req, res) => {
  const data = roomSchema.partial().parse(req.body);
  res.json(
    await transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${req.params.id} FOR UPDATE`;
      if (
        data.capacity &&
        (await tx.eventRoomBooking.findFirst({
          where: {
            roomId: req.params.id,
            endAt: { gt: new Date() },
            event: { capacity: { gt: data.capacity } }
          }
        }))
      )
        fail(409, 'An upcoming event needs the current room capacity.');
      return tx.room.update({ where: { id: req.params.id }, data });
    })
  );
});
api.delete('/rooms/:id', admin, async (req, res) => {
  if (
    await db.eventRoomBooking.findFirst({
      where: { roomId: req.params.id },
      select: { id: true }
    })
  )
    fail(409, 'This room is still used by event bookings.');
  await db.room.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
api.get('/departments', auth, async (req, res) =>
  res.json(
    await db.department.findMany({
      include: { _count: { select: { users: true, events: true } } },
      orderBy: { name: 'asc' }
    })
  )
);
api.post('/departments', admin, async (req, res) =>
  res
    .status(201)
    .json(
      await db.department.create({ data: departmentSchema.parse(req.body) })
    )
);
api.patch('/departments/:id', admin, async (req, res) =>
  res.json(
    await db.department.update({
      where: { id: req.params.id },
      data: departmentSchema.partial().parse(req.body)
    })
  )
);
api.delete('/departments/:id', admin, async (req, res) => {
  await db.department.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
api.get('/users', admin, async (req, res) =>
  res.json(
    await db.user.findMany({
      select: userSelect,
      orderBy: { name: 'asc' },
      take: 500
    })
  )
);
api.patch('/users/:id/role', admin, async (req, res) => {
  const { role } = z
    .object({ role: z.enum(['STUDENT', 'ORGANIZER', 'ADMIN']) })
    .strict()
    .parse(req.body);
  if (req.params.id === req.user.id)
    fail(409, 'You cannot change your own administrator role.');
  res.json(
    await db.user.update({
      where: { id: req.params.id },
      data: { role },
      select: userSelect
    })
  );
});
api.patch('/users/:id/department', admin, async (req, res) => {
  const { departmentId } = z
    .object({ departmentId: z.string().min(1).nullable() })
    .strict()
    .parse(req.body);
  if (
    departmentId &&
    !(await db.department.findUnique({ where: { id: departmentId } }))
  )
    fail(400, 'Department not found.');
  res.json(
    await db.user.update({
      where: { id: req.params.id },
      data: { departmentId },
      select: userSelect
    })
  );
});
api.get('/admin/api-keys', admin, async (req, res) =>
  res.json(
    await db.apiKey.findMany({
      select: {
        id: true,
        ownerLabel: true,
        scope: true,
        active: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
  )
);
api.post('/admin/api-keys', admin, async (req, res) => {
  const input = z
    .object({
      ownerLabel: z.string().trim().min(2).max(100),
      scope: z
        .array(z.enum(['assistlink:events:read', 'assistlink:events:register']))
        .min(1)
    })
    .strict()
    .parse(req.body);
  const rawKey = `campus_${randomBytes(32).toString('base64url')}`;
  const record = await db.apiKey.create({
    data: { ...input, keyHash: hashKey(rawKey) },
    select: {
      id: true,
      ownerLabel: true,
      scope: true,
      active: true,
      createdAt: true
    }
  });
  res.status(201).json({ ...record, key: rawKey });
});
api.delete('/admin/api-keys/:id', admin, async (req, res) => {
  await db.apiKey.update({
    where: { id: req.params.id },
    data: { active: false }
  });
  res.status(204).end();
});
api.get('/integrations', managers, (req, res) =>
  res.json({
    googleCalendar: calendarConfigured(),
    assistLink: assistLinkConfigured(),
    microsoft: !!process.env.MICROSOFT_API_CLIENT_ID,
    keyVault: !!process.env.AZURE_KEY_VAULT_URL
  })
);
