import { PrismaClient } from '@prisma/client';
export const db = new PrismaClient();

export async function transaction(work) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: 'Serializable',
        timeout: 15000
      });
    } catch (error) {
      if (error.code !== 'P2034' || attempt === 4) throw error;
    }
  }
}
