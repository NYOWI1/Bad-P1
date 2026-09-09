import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { db } from '../config/db.js';
import { fail } from './errorHandler.js';

export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  department: true
};
export function issueToken(user) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: user.id,
    expiresIn: '8h',
    algorithm: 'HS256',
    issuer: 'campus-events',
    audience: 'campus-client'
  });
}
export async function optionalAuth(req, res, next) {
  const header = req.get('authorization');
  if (!header) return next();
  try {
    if (!header.startsWith('Bearer '))
      fail(401, 'Invalid authorization header.');
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'campus-events',
      audience: 'campus-client'
    });
    req.user = await db.user.findUnique({
      where: { id: payload.sub },
      select: userSelect
    });
    if (!req.user) fail(401, 'Account not found.');
    next();
  } catch {
    next(
      Object.assign(
        new Error('Your session has expired. Please sign in again.'),
        { status: 401 }
      )
    );
  }
}
export function auth(req, res, next) {
  if (!req.user) fail(401, 'Please sign in to continue.');
  next();
}
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    auth(req, res, () => {
      if (!roles.includes(req.user.role))
        fail(403, 'Your role does not allow this action.');
      next();
    });
  };
export function owns(user, event) {
  if (user.role !== 'ADMIN' && event.organizerId !== user.id)
    fail(403, 'You can only manage your own events.');
}
export const hashKey = (key) => createHash('sha256').update(key).digest('hex');
export const peerAuth = (scope) => async (req, res, next) => {
  const raw = req.get('x-api-key');
  if (!raw || raw.length > 512) fail(401, 'Invalid API key.');
  const key = await db.apiKey.findUnique({ where: { keyHash: hashKey(raw) } });
  if (!key?.active) fail(401, 'Invalid API key.');
  if (!key.scope.includes(scope))
    fail(403, 'API key does not have the required scope.');
  req.apiKey = key;
  next();
};
