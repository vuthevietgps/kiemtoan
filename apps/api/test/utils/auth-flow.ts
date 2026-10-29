import request from 'supertest';
import type { TestContext, TestUser } from './test-app';

export interface LoginResult {
  accessToken: string;
  user: { id: string; mustChangePassword: boolean };
  permissions: string[];
}
export async function login(ctx: TestContext, email: string, password: string) {
  const response = await request(ctx.app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const body = response.body as LoginResult;
  const cookies = response.headers['set-cookie'] as unknown as string[];
  return {
    ...body,
    cookie: cookies[0].split(';')[0],
    cookieHeader: cookies[0],
  };
}
export function asUser(
  _ctx: TestContext,
  token: string,
  id = 'test',
): TestUser {
  return { id, token, email: '', teamId: null };
}
export async function relogin(
  ctx: TestContext,
  user: TestUser,
  password = 'Test@123',
): Promise<void> {
  user.token = (await login(ctx, user.email, password)).accessToken;
}
