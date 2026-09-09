import { db, transaction } from '../config/db.js';
import { fail } from '../middleware/errorHandler.js';
import { owns } from '../middleware/auth.js';

export const activeRegistration = { not: 'CANCELLED' };
export const eventInclude = {
  organizer: { select: { id: true, name: true } },
  department: true,
  roomBookings: { include: { room: true } },
  _count: {
    select: { registrations: { where: { status: activeRegistration } } }
  }
};
export async function getEvent(id) {
  const event = await db.event.findUnique({
    where: { id },
    include: eventInclude
  });
  if (!event) fail(404, 'Event not found.');
  return event;
}
export function visibleTo(event, user) {
  if (
    !['PUBLISHED', 'CLOSED'].includes(event.status) &&
    user?.role !== 'ADMIN' &&
    !(user?.role === 'ORGANIZER' && event.organizerId === user.id)
  )
    fail(404, 'Event not found.');
}
export async function writeEvent(user, id, input) {
  return transaction(async (tx) => {
    let old;
    if (id) {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${id} FOR UPDATE`;
      old = await tx.event.findUnique({
        where: { id },
        include: { roomBookings: true }
      });
      if (!old) fail(404, 'Event not found.');
      owns(user, old);
      if (['CANCELLED', 'CLOSED'].includes(old.status))
        fail(409, 'This event can no longer be edited.');
    }
    const { roomId, ...data } = input;
    const merged = { ...old, ...data };
    if (new Date(merged.endAt) <= new Date(merged.startAt))
      fail(400, 'End time must be after start time.');
    if (new Date(merged.startAt) <= new Date())
      fail(400, 'Event must start in the future.');
    if (
      merged.registrationClosesAt &&
      new Date(merged.registrationClosesAt) > new Date(merged.startAt)
    )
      fail(400, 'Registration must close before the event starts.');
    if (
      !(await tx.department.findUnique({ where: { id: merged.departmentId } }))
    )
      fail(400, 'Department not found.');
    if (
      id &&
      (await tx.eventRegistration.count({
        where: { eventId: id, status: activeRegistration }
      })) > merged.capacity
    )
      fail(409, 'Capacity cannot be lower than the current attendee count.');
    const chosenRoom =
      roomId === undefined ? old?.roomBookings[0]?.roomId : roomId;
    const roomIds = [
      ...new Set(
        [chosenRoom, ...(old?.roomBookings.map((b) => b.roomId) || [])].filter(
          Boolean
        )
      )
    ].sort();
    for (const lockId of roomIds)
      await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${lockId} FOR UPDATE`;
    if (chosenRoom) {
      const room = await tx.room.findUnique({ where: { id: chosenRoom } });
      if (!room) fail(400, 'Room not found.');
      if (room.capacity < merged.capacity)
        fail(409, 'The room is too small for this event.');
      const clash = await tx.eventRoomBooking.findFirst({
        where: {
          roomId: chosenRoom,
          ...(id ? { eventId: { not: id } } : {}),
          startAt: { lt: new Date(merged.endAt) },
          endAt: { gt: new Date(merged.startAt) }
        }
      });
      if (clash) fail(409, 'Room is already booked during this time.');
      data.location = `${room.name}, ${room.building}`;
    }
    const event = id
      ? await tx.event.update({ where: { id }, data })
      : await tx.event.create({ data: { ...data, organizerId: user.id } });
    if (id) await tx.eventRoomBooking.deleteMany({ where: { eventId: id } });
    if (chosenRoom)
      await tx.eventRoomBooking.create({
        data: {
          eventId: event.id,
          roomId: chosenRoom,
          startAt: event.startAt,
          endAt: event.endAt
        }
      });
    return event;
  });
}
export async function registerStudent(eventId, studentId, external) {
  return transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) fail(404, 'Event not found.');
    if (event.status !== 'PUBLISHED')
      fail(409, 'Registration is not open for this event.');
    if (new Date(event.registrationClosesAt || event.startAt) <= new Date())
      fail(409, 'Registration has closed.');
    if (external) {
      // Never attach a peer identity to a privileged local account or rewrite a verified identity.
      let student = await tx.user.findUnique({
        where: { email: external.email }
      });
      if (student && student.role !== 'STUDENT')
        fail(409, 'This email cannot be registered as a student.');
      if (!student) {
        const department = external.department
          ? await tx.department.findFirst({
              where: { name: external.department }
            })
          : null;
        student = await tx.user.create({
          data: {
            email: external.email,
            name: external.name,
            departmentId: department?.id
          }
        });
      }
      studentId = student.id;
    }
    const existing = await tx.eventRegistration.findUnique({
      where: { eventId_studentId: { eventId, studentId } }
    });
    if (existing && existing.status !== 'CANCELLED')
      fail(409, 'You are already registered for this event.');
    if (
      (await tx.eventRegistration.count({
        where: { eventId, status: activeRegistration }
      })) >= event.capacity
    )
      fail(409, 'Event is full.');
    const data = {
      status: 'REGISTERED',
      source: external ? 'ASSISTLINK' : 'CAMPUS',
      externalRefId: external?.externalStudentId || null,
      registeredAt: new Date()
    };
    return tx.eventRegistration.upsert({
      where: { eventId_studentId: { eventId, studentId } },
      create: { eventId, studentId, ...data },
      update: data
    });
  });
}
