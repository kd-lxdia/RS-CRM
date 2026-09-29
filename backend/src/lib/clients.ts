import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

const basePrisma = new PrismaClient();

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);
        
        if (['update', 'upsert', 'delete', 'updateMany', 'deleteMany'].includes(operation)) {
          if (model === 'Customer' || model === 'Lead') {
            try {
              const { broadcastEntityUpdate } = require('./socket');
              const entityId = (result as any)?.id;
              if (entityId) {
                // Fire-and-forget sync
                broadcastEntityUpdate(model.toUpperCase(), entityId);
              }
            } catch (e) {
              // Do not crash the app tracking socket broadcast 
            }
          }
        }

        return result;
      }
    }
  }
}) as unknown as PrismaClient;

type QueueLike = {
  add: (name: string, data: unknown, opts?: any) => Promise<any>;
};

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisEnabled = process.env.DISABLE_REDIS !== 'true';

export let redis: Redis | null = null;
export let redisAvailable = false;

if (redisEnabled) {
  const client = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: () => null,
  });

  client.on('ready', () => {
    redisAvailable = true;
  });

  client.on('error', () => {
    redisAvailable = false;
  });

  client.connect().catch(() => {
    redisAvailable = false;
  });

  redis = client;
}

const noopQueue: QueueLike = {
  async add(_name: string, _data: unknown, _opts?: any) {
    return null;
  },
};

export const emailQueue: QueueLike = redis ? new Queue('email-campaigns', { connection: redis }) : noopQueue;
export const whatsappQueue: QueueLike = redis ? new Queue('whatsapp-campaigns', { connection: redis }) : noopQueue;
