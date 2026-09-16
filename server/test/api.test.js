import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import request from 'supertest';

let embedded,
  socket,
  db,
  app,
  tokens = {},
  eventId,
  secondStudentToken;
const base = '/project/api';
const input = (overrides = {}) => ({
  title: 'Test campus workshop',
  description:
    'A practical workshop for students to learn something new together.',
  category: 'Technology',
  location: 'Test Hall',
  capacity: 2,
  departmentId: 'test-dept',
  startAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  endAt: new Date(Date.now() + 7 * 86400000 + 7200000).toISOString(),
  ...overrides
});
const as = (method, path, role = 'ORGANIZER') =>
  request(app)
    [method](`${base}${path}`)
    .set('Authorization', `Bearer ${tokens[role]}`);
before(async () => {
  process.env.NODE_ENV = 'development';
  process.env.DEMO_AUTH = 'true';
  process.env.JWT_SECRET =
    'test-only-secret-with-more-than-thirty-two-characters';
  for (const key of [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_CALENDAR_ID'
  ])
    process.env[key] = '';
  embedded = await PGlite.create();
  await embedded.exec(
    await readFile(
      new URL(
        '../prisma/migrations/20260903000000_init/migration.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  socket = new PGLiteSocketServer({ db: embedded, host: '127.0.0.1', port: 0 });
  await socket.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  ({ db } = await import('../src/config/db.js'));
  ({ app } = await import('../src/app.js'));
  await db.department.create({
    data: { id: 'test-dept', name: 'Test Department', code: 'TEST' }
  });
  for (const role of ['STUDENT', 'ORGANIZER', 'ADMIN']) {
    await db.user.create({
      data: {
        id: `test-${role}`,
        email: `${role.toLowerCase()}@demo.campus.local`,
        name: `Test ${role}`,
        role,
        departmentId: 'test-dept'
      }
    });
    const response = await request(app)
      .post(`${base}/auth/demo`)
      .send({ role });
    assert.equal(response.status, 200);
    tokens[role] = response.body.token;
  }
  const other = await db.user.create({
    data: { email: 'second@demo.campus.local', name: 'Second Student' }
  });
  const { issueToken } = await import('../src/middleware/auth.js');
  secondStudentToken = issueToken(other);
});
after(async () => {
  if (db) await db.$disconnect();
  if (socket) await socket.stop();
  if (embedded) await embedded.close();
});

test('anonymous access and student role cannot create events', async () => {
  assert.equal(
    (await request(app).post(`${base}/events`).send(input())).status,
    401
  );
  assert.equal(
    (await as('post', '/events', 'STUDENT').send(input())).status,
    403
  );
  assert.equal(
    (
      await as('post', '/rooms', 'STUDENT').send({
        name: 'Room',
        building: 'Building',
        capacity: 10
      })
    ).status,
    403
  );
});
test('invalid dates and empty partial payloads are validated', async () => {
  assert.equal(
    (
      await as('post', '/events').send(
        input({ endAt: new Date().toISOString() })
      )
    ).status,
    400
  );
  assert.equal(
    (await as('post', '/events').send(input({ capacity: 0 }))).status,
    400
  );
});
test('drafts are private, then publishing exposes them', async () => {
  const created = await as('post', '/events').send(input());
  assert.equal(created.status, 201);
  eventId = created.body.id;
  assert.equal(created.body.status, 'DRAFT');
  assert.equal(
    (await request(app).get(`${base}/events/${eventId}`)).status,
    404
  );
  assert.equal((await request(app).get(`${base}/events`)).body.length, 0);
  assert.equal(
    (await as('post', `/events/${eventId}/registrations`, 'STUDENT')).status,
    409
  );
  const published = await as('post', `/events/${eventId}/publish`);
  assert.equal(published.status, 200);
  assert.equal(published.body.calendarSyncStatus, 'NOT_CONFIGURED');
  assert.equal((await request(app).get(`${base}/events`)).body.length, 1);
});
test('organizers cannot modify another organizer’s event', async () => {
  const other = await db.user.create({
    data: {
      email: 'other-organizer@campus.local',
      name: 'Other Organizer',
      role: 'ORGANIZER'
    }
  });
  const { issueToken } = await import('../src/middleware/auth.js');
  const token = issueToken(other);
  assert.equal(
    (
      await request(app)
        .patch(`${base}/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Not my event' })
    ).status,
    403
  );
  assert.equal(
    (
      await request(app)
        .get(`${base}/events/${eventId}/registrations`)
        .set('Authorization', `Bearer ${token}`)
    ).status,
    403
  );
});
test('duplicate registration is rejected, including concurrent requests', async () => {
  const results = await Promise.all([
    as('post', `/events/${eventId}/registrations`, 'STUDENT'),
    as('post', `/events/${eventId}/registrations`, 'STUDENT')
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await db.eventRegistration.count({ where: { eventId } }), 1);
});
test('the final seat cannot be oversold under concurrent requests', async () => {
  const third = await db.user.create({
    data: { email: 'third@demo.campus.local', name: 'Third Student' }
  });
  const { issueToken } = await import('../src/middleware/auth.js');
  const responses = await Promise.all(
    [secondStudentToken, issueToken(third)].map((token) =>
      request(app)
        .post(`${base}/events/${eventId}/registrations`)
        .set('Authorization', `Bearer ${token}`)
    )
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await db.eventRegistration.count({
      where: { eventId, status: 'REGISTERED' }
    }),
    2
  );
  assert.equal(
    (await as('patch', `/events/${eventId}`).send({ capacity: 1 })).status,
    409
  );
});
test('cancellation releases a seat and allows re-registration', async () => {
  assert.equal(
    (await as('delete', `/events/${eventId}/registrations/me`, 'STUDENT'))
      .status,
    200
  );
  assert.equal(
    (await as('post', `/events/${eventId}/registrations`, 'STUDENT')).status,
    201
  );
  assert.equal(
    (await as('get', '/registrations/me', 'STUDENT')).body.length,
    1
  );
});
test('room conflicts and insufficient room capacity are rejected', async () => {
  const room = await as('post', '/rooms', 'ADMIN').send({
    name: 'Test Room',
    building: 'Test Building',
    capacity: 20
  });
  assert.equal(room.status, 201);
  assert.equal(
    (
      await as('post', '/events').send(
        input({ roomId: room.body.id, capacity: 21 })
      )
    ).status,
    409
  );
  const responses = await Promise.all(
    [1, 2].map(() =>
      as('post', '/events').send(input({ roomId: room.body.id }))
    )
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await as('patch', `/rooms/${room.body.id}`, 'ADMIN').send({ capacity: 1 }))
      .status,
    409
  );
  assert.equal(
    (await as('delete', `/rooms/${room.body.id}`, 'ADMIN')).status,
    409
  );
});
test('attendance is forbidden before an event starts', async () => {
  const rows = await as('get', `/events/${eventId}/registrations`);
  assert.equal(rows.status, 200);
  assert.equal(
    (
      await as('patch', `/registrations/${rows.body[0].id}`).send({
        status: 'ATTENDED'
      })
    ).status,
    409
  );
});
test('attendance is tracked after start; cancelled registrations stay cancelled', async () => {
  const past = await db.event.create({
    data: {
      ...input(),
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() + 3600000),
      organizerId: 'test-ORGANIZER',
      status: 'PUBLISHED'
    }
  });
  const registration = await db.eventRegistration.create({
    data: { eventId: past.id, studentId: 'test-STUDENT' }
  });
  assert.equal(
    (
      await as('patch', `/registrations/${registration.id}`).send({
        status: 'ATTENDED'
      })
    ).status,
    200
  );
  assert.equal(
    (await as('delete', `/events/${past.id}/registrations/me`, 'STUDENT'))
      .status,
    409
  );
  await db.eventRegistration.update({
    where: { id: registration.id },
    data: { status: 'CANCELLED' }
  });
  assert.equal(
    (
      await as('patch', `/registrations/${registration.id}`).send({
        status: 'ATTENDED'
      })
    ).status,
    409
  );
});
test('peer API keys are hashed, scoped, and revocable', async () => {
  assert.equal((await request(app).get(`${base}/peer/v1/events`)).status, 401);
  const created = await as('post', '/admin/api-keys', 'ADMIN').send({
    ownerLabel: 'Partner client',
    scope: ['peer:events:read']
  });
  assert.equal(created.status, 201);
  const key = created.body.key;
  assert.ok(key);
  assert.equal(created.body.keyHash, undefined);
  const stored = await db.apiKey.findUnique({ where: { id: created.body.id } });
  assert.notEqual(stored.keyHash, key);
  assert.equal(stored.keyHash.length, 64);
  const list = await request(app)
    .get(`${base}/peer/v1/events`)
    .set('x-api-key', key);
  assert.equal(list.status, 200);
  assert.equal(list.body.events[0].organizerId, undefined);
  assert.equal(
    (
      await request(app)
        .post(`${base}/peer/v1/events/${eventId}/registrations`)
        .set('x-api-key', key)
        .send({})
    ).status,
    403
  );
  await as('delete', `/admin/api-keys/${created.body.id}`, 'ADMIN');
  assert.equal(
    (await request(app).get(`${base}/peer/v1/events`).set('x-api-key', key))
      .status,
    401
  );
  assert.ok(
    (await as('get', '/admin/api-keys', 'ADMIN')).body.every(
      (k) => !k.key && !k.keyHash
    )
  );
});
test('peer API registrations use the same capacity and duplicate checks', async () => {
  const created = await as('post', '/admin/api-keys', 'ADMIN').send({
    ownerLabel: 'Partner writer',
    scope: ['peer:events:register']
  });
  const payload = {
    externalStudentId: 'peer-001',
    name: 'Peer Student',
    email: 'peer@university.edu',
    department: 'Test Department'
  };
  const register = () =>
    request(app)
      .post(`${base}/peer/v1/events/${eventId}/registrations`)
      .set('x-api-key', created.body.key)
      .send(payload);
  assert.equal((await register()).status, 409);
  await as('patch', `/events/${eventId}`).send({ capacity: 3 });
  const result = await register();
  assert.equal(result.status, 201);
  assert.equal(result.body.studentId, undefined);
  assert.equal((await register()).status, 409);
  const stored = await db.eventRegistration.findUnique({
    where: { id: result.body.id }
  });
  assert.equal(stored.source, 'PEER');
  assert.equal(stored.externalRefId, 'peer-001');
});
test('closing blocks new registrations; cancelling hides events; admins can delete cancelled events', async () => {
  assert.equal((await as('post', `/events/${eventId}/close`)).status, 200);
  assert.equal(
    (await as('post', `/events/${eventId}/registrations`, 'STUDENT')).status,
    409
  );
  assert.equal((await as('post', `/events/${eventId}/publish`)).status, 409);
  assert.equal((await as('delete', `/events/${eventId}`)).status, 200);
  assert.equal(
    (await request(app).get(`${base}/events/${eventId}`)).status,
    404
  );
  assert.equal(
    await db.eventRegistration.count({
      where: { eventId, status: 'REGISTERED' }
    }),
    0
  );
  assert.equal((await as('delete', `/events/${eventId}`)).status, 403);
  assert.equal((await as('delete', `/events/${eventId}`, 'ADMIN')).status, 204);
  assert.equal(await db.event.findUnique({ where: { id: eventId } }), null);
  assert.equal(await db.eventRegistration.count({ where: { eventId } }), 0);
});
test('role and department updates apply to users', async () => {
  const newDepartment = await db.department.create({
    data: { name: 'Business Department', code: 'BUS' }
  });
  const departmentResult = await as(
    'patch',
    '/users/test-STUDENT/department',
    'ADMIN'
  ).send({
    departmentId: newDepartment.id
  });
  assert.equal(departmentResult.status, 200);
  assert.equal(departmentResult.body.departmentId, newDepartment.id);
  assert.equal(departmentResult.body.department.name, 'Business Department');
  assert.equal(
    (
      await as('patch', '/users/test-STUDENT/department', 'ADMIN').send({
        departmentId: null
      })
    ).body.departmentId,
    null
  );
  assert.equal(
    (
      await as('patch', '/users/test-STUDENT/department', 'ADMIN').send({
        departmentId: 'missing'
      })
    ).status,
    400
  );
  assert.equal(
    (
      await as('patch', '/users/test-STUDENT/role', 'ADMIN').send({
        role: 'ORGANIZER'
      })
    ).status,
    200
  );
  assert.equal(
    (await as('post', '/events', 'STUDENT').send(input())).status,
    201
  );
  assert.equal(
    (
      await as('patch', '/users/test-ADMIN/role', 'ADMIN').send({
        role: 'STUDENT'
      })
    ).status,
    409
  );
});
test('development authentication is disabled in production', async () => {
  process.env.NODE_ENV = 'production';
  try {
    assert.equal(
      (await request(app).post(`${base}/auth/demo`).send({ role: 'ADMIN' }))
        .status,
      404
    );
  } finally {
    process.env.NODE_ENV = 'development';
  }
});
