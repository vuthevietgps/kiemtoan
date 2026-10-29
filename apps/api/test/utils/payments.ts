/* eslint-disable @typescript-eslint/no-unsafe-member-access -- res.body của supertest có kiểu any */
import { TestContext } from './test-app';

/**
 * 07-C: thu tiền qua đủ vòng đời — Kế toán thu tiền lập phiếu tiền mặt kèm số phiếu giấy (J8), gửi
 * duyệt; người duyệt (mặc định GĐ, khác người lập — J1) duyệt. Trả id phiếu (revision sau duyệt = 3).
 */
export async function collectPayment(
  ctx: TestContext,
  body: Record<string, unknown>,
  approver: keyof TestContext['users'] = 'director',
): Promise<string> {
  const created = await ctx
    .api(ctx.users.cashier)
    .post('/payments')
    .send({ method: 'CASH', documentNumber: 'PT-GIAY-01', ...body })
    .expect(201);
  const id = created.body.id as string;
  await ctx
    .api(ctx.users.cashier)
    .post(`/payments/${id}/submit`)
    .send({ revision: 1 })
    .expect(200);
  await ctx
    .api(ctx.users[approver])
    .post(`/payments/${id}/approve`)
    .send({ revision: 2 })
    .expect(200);
  return id;
}
