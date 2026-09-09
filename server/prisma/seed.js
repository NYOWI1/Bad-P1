import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';

export async function seed(prisma) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development seed must not run in production.');
  const departments = [
    { id: 'dept-cs', name: 'Computer Science', code: 'CS' },
    { id: 'dept-arts', name: 'Arts & Humanities', code: 'ART' },
    { id: 'dept-bus', name: 'Business Administration', code: 'BUS' },
    { id: 'dept-eng', name: 'Engineering', code: 'ENG' }
  ];
  for (const d of departments)
    await prisma.department.upsert({
      where: { id: d.id },
      create: d,
      update: {}
    });
  const adminUser = {
    id: 'admin-u6622062',
    name: 'Kaung Zaw Hein',
    email: 'u6622062@au.edu',
    role: 'ADMIN',
    departmentId: 'dept-cs'
  };
  await prisma.user.upsert({
    where: { email: adminUser.email },
    create: adminUser,
    update: {
      name: adminUser.name,
      role: adminUser.role,
      departmentId: adminUser.departmentId
    }
  });

  const rooms = [
    {
      id: 'room-1',
      name: 'Innovation Lab',
      building: 'Science Building',
      capacity: 80
    },
    {
      id: 'room-2',
      name: 'The Gallery',
      building: 'Arts Center',
      capacity: 120
    },
    {
      id: 'room-3',
      name: 'Main Auditorium',
      building: 'Student Union',
      capacity: 300
    },
    {
      id: 'room-4',
      name: 'Seminar Room 204',
      building: 'Business Building',
      capacity: 50
    }
  ];
  for (const room of rooms)
    await prisma.room.upsert({
      where: { id: room.id },
      create: room,
      update: {}
    });
  const specs = [
    [
      'Build something that matters',
      'Technology',
      'A hands-on hackathon for curious minds. Bring an idea, meet your team, and build a working prototype that makes campus life better. Mentors will help with design, code, and your final pitch. All skill levels are welcome; bring your laptop and we will bring the snacks.',
      2,
      10,
      80,
      'room-1',
      'dept-cs'
    ],
    [
      'An evening of art & expression',
      'Arts & Culture',
      'Step inside our student gallery for an evening of original artwork, live poetry, and conversations with the people behind the pieces. Explore the exhibition at your own pace, make something at the community canvas, and stay for the open mic.',
      3,
      17,
      100,
      'room-2',
      'dept-arts'
    ],
    [
      'Your next chapter starts here',
      'Career',
      'Meet alumni and local industry teams at our campus career meetup. Join small-group conversations about internships, portfolios, and the transition from university to work. Bring your questions and leave with practical next steps and new connections.',
      5,
      13,
      200,
      'room-3',
      'dept-bus'
    ],
    [
      'Find your morning rhythm',
      'Wellness',
      'Take a break from your screen and start the day with a gentle movement and mindfulness session on the campus lawn. No previous experience is needed. Bring a mat or towel and a water bottle; comfortable clothing is recommended.',
      6,
      7,
      40,
      null,
      'dept-arts'
    ],
    [
      'Coffee, connections & good ideas',
      'Community',
      'Your weekly excuse to meet someone new. Join students from across campus for coffee, conversation prompts, and informal idea sharing. Come alone or bring a friend. Coffee and tea are provided, and every department is welcome.',
      7,
      11,
      50,
      'room-4',
      'dept-bus'
    ],
    [
      'Research without the overwhelm',
      'Academic',
      'Learn how to turn a broad question into a focused research plan. This practical workshop covers finding reliable sources, organizing references, and communicating your results. Ideal for students starting a project or exploring an assistantship.',
      9,
      14,
      60,
      'room-1',
      'dept-cs'
    ],
    [
      'Design for people, not just pixels',
      'Technology',
      'Get hands-on with user research, rapid prototyping, and accessible interaction design. Work through a real campus challenge in small teams and practice giving constructive feedback. Bring a laptop and an open mind.',
      12,
      10,
      50,
      'room-1',
      'dept-cs'
    ],
    [
      'Campus sounds: the unplugged session',
      'Arts & Culture',
      'An intimate afternoon of acoustic music performed by students. Discover new artists, cheer on your friends, and enjoy a relaxed set of original songs and familiar favorites. Seating is first come, first served for registered attendees.',
      14,
      16,
      100,
      'room-2',
      'dept-arts'
    ]
  ];
  for (let index = 0; index < specs.length; index++) {
    const [
      title,
      category,
      description,
      days,
      hour,
      capacity,
      roomId,
      departmentId
    ] = specs[index];
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + days);
    startAt.setHours(hour, 0, 0, 0);
    const endAt = new Date(startAt.getTime() + 2 * 3600000);
    const room = rooms.find((r) => r.id === roomId);
    await prisma.event.upsert({
      where: { id: `event-${index + 1}` },
      update: {
        title,
        category,
        description,
        startAt,
        endAt,
        capacity,
        departmentId,
        organizerId: adminUser.id,
        location: room
          ? `${room.name}, ${room.building}`
          : 'North Lawn, Main Campus',
        status: 'PUBLISHED',
        calendarSyncStatus: 'NOT_CONFIGURED'
      },
      create: {
        id: `event-${index + 1}`,
        title,
        category,
        description,
        startAt,
        endAt,
        capacity,
        departmentId,
        organizerId: adminUser.id,
        location: room
          ? `${room.name}, ${room.building}`
          : 'North Lawn, Main Campus',
        status: 'PUBLISHED',
        calendarSyncStatus: 'NOT_CONFIGURED',
        ...(roomId
          ? { roomBookings: { create: { roomId, startAt, endAt } } }
          : {})
      }
    });
  }
  await prisma.event.updateMany({
    where: { organizerId: { in: ['demo-organizer', 'organizer-arts'] } },
    data: { organizerId: adminUser.id }
  });
  await prisma.eventRegistration.deleteMany({
    where: {
      OR: [
        { studentId: 'demo-student' },
        { studentId: { startsWith: 'student-' } }
      ]
    }
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: { in: ['demo-student', 'demo-organizer', 'demo-admin', 'organizer-arts'] } },
        { id: { startsWith: 'student-' } },
        { email: { endsWith: '@demo.campus.local' } }
      ]
    }
  });

  console.log('Campus seed data is ready.');
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const prisma = new PrismaClient();
  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
