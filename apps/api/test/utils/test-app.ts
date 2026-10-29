import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/core/bootstrap';
import { PrismaService } from '../../src/core/prisma/prisma.service';

export const TEST_PASSWORD = 'Test@123';

export interface TestUser {
  id: string;
  email: string;
  token: string;
  teamId: string | null;
}

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  /** Một người dùng đã đăng nhập cho mỗi vai trò; staff2 là nhân viên thứ hai cùng nhóm. */
  users: Record<
    'director' | 'manager' | 'staff' | 'staff2' | 'cashier' | 'admin',
    TestUser
  >;
  /** Gọi API kèm token: api(ctx.users.staff).get('/customers') */
  api: (user: TestUser) => {
    get: (url: string) => request.Test;
    post: (url: string) => request.Test;
    patch: (url: string) => request.Test;
    put: (url: string) => request.Test;
    delete: (url: string) => request.Test;
  };
}

/** Xoá sạch mọi bảng (trừ bảng hệ thống của Prisma). */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  try {
    // Chờ khoá tối đa 10 giây rồi báo lỗi rõ ràng thay vì treo tới hết thời hạn hook (30 giây).
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET LOCAL lock_timeout = '10s'`),
      prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE`),
    ]);
  } catch (error) {
    const holders = await prisma.$queryRaw<{ state: string; query: string }[]>`
      SELECT state, left(query, 120) AS query FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
        AND state <> 'idle'`;
    throw new Error(
      `Không xoá được DB test vì còn phiên giữ khoá: ${JSON.stringify(holders)}`,
      { cause: error },
    );
  }
}

/**
 * Trình nghe sự kiện phát kiểu không chờ (`emit`) vẫn chạy sau khi request trả về. Theo dõi chúng để
 * `app.close()` chờ xong rồi mới đóng — tránh transaction dở dang giữ khoá DB làm treo bộ test sau.
 */
function settleEventsOnClose(app: INestApplication<App>): void {
  const emitter = app.get(EventEmitter2);
  const pending = new Set<Promise<unknown>>();
  emitter.emit = ((event: string | symbol, ...values: unknown[]) => {
    const run = emitter.emitAsync(event, ...values).catch(() => undefined);
    pending.add(run);
    void run.finally(() => pending.delete(run));
    return emitter.listenerCount(event) > 0;
  }) as EventEmitter2['emit'];
  const close = app.close.bind(app);
  app.close = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
    return close();
  };
}

/**
 * Dựng app giống hệt khi chạy thật, làm sạch database, tạo người dùng cho mỗi vai trò và đăng nhập.
 * Dùng trong beforeAll của mỗi file e2e; nhớ gọi ctx.app.close() trong afterAll.
 */
export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  settleEventsOnClose(app);
  try {
    return await seedContext(app);
  } catch (error) {
    // Dựng dữ liệu lỗi (vd. chờ khoá DB quá lâu): đóng app để Jest thoát được, không treo máy.
    await app.close();
    throw error;
  }
}

async function seedContext(app: INestApplication<App>): Promise<TestContext> {
  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);

  const team = await prisma.team.create({ data: { name: 'Nhóm test' } });
  const otherTeam = await prisma.team.create({ data: { name: 'Nhóm khác' } });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const specs: [keyof TestContext['users'], Role, string | null][] = [
    ['director', Role.DIRECTOR, null],
    ['manager', Role.MANAGER, team.id],
    ['staff', Role.STAFF, team.id],
    ['staff2', Role.STAFF, otherTeam.id],
    ['cashier', Role.CASHIER, null],
    ['admin', Role.ADMIN, null],
  ];

  const users = {} as TestContext['users'];
  for (const [key, role, teamId] of specs) {
    const email = `${key}@test.vn`;
    const user = await prisma.user.create({
      data: { email, fullName: `Test ${key}`, role, teamId, passwordHash },
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    users[key] = {
      id: user.id,
      email,
      teamId,
      token: (res.body as { accessToken: string }).accessToken,
    };
  }

  const api = (user: TestUser) => {
    const server = request(app.getHttpServer());
    const auth = (t: request.Test) =>
      t.set('Authorization', `Bearer ${user.token}`);
    return {
      get: (url: string) => auth(server.get(`/api/v1${url}`)),
      post: (url: string) => auth(server.post(`/api/v1${url}`)),
      patch: (url: string) => auth(server.patch(`/api/v1${url}`)),
      put: (url: string) => auth(server.put(`/api/v1${url}`)),
      delete: (url: string) => auth(server.delete(`/api/v1${url}`)),
    };
  };

  return { app, prisma, users, api };
}
