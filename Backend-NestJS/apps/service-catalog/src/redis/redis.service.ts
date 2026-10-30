import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client = createClient({
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  });

  constructor() {
    this.client.on('error', (error) =>
      this.logger.error('Redis connection error', error),
    );
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Connected to Redis');
  }

  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit();
  }

  get(key: string) {
    return this.client.get(key);
  }

  set(key: string, value: string, ttlSeconds: number) {
    return this.client.set(key, value, { EX: ttlSeconds });
  }

  async deletePattern(pattern: string) {
    let cursor = '0';

    do {
      const result = await this.client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      if (result.keys.length) await this.client.del(result.keys);
      cursor = result.cursor;
    } while (cursor !== '0');
  }
}
