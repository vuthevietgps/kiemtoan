import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/** Mật khẩu chung cho mọi tài khoản demo. */
export const DEMO_PASSWORD = 'Demo@123';

export const DEMO_USERS: {
  email: string;
  fullName: string;
  role: Role;
  title: string;
  team?: string;
}[] = [
  {
    email: 'giamdoc@demo.vn',
    fullName: 'Trần Văn Minh',
    role: Role.DIRECTOR,
    title: 'Giám đốc',
  },
  {
    email: 'ketoantruong@demo.vn',
    fullName: 'Nguyễn Thị Linh',
    role: Role.MANAGER,
    title: 'Kế toán trưởng',
    team: 'Nhóm Thuế 1',
  },
  {
    email: 'nhanvien1@demo.vn',
    fullName: 'Lê Văn An',
    role: Role.STAFF,
    title: 'Kế toán viên',
    team: 'Nhóm Thuế 1',
  },
  {
    email: 'nhanvien2@demo.vn',
    fullName: 'Phạm Thu Hà',
    role: Role.STAFF,
    title: 'Kế toán viên',
    team: 'Nhóm Thuế 1',
  },
  {
    email: 'nhanvien3@demo.vn',
    fullName: 'Đỗ Quang Huy',
    role: Role.STAFF,
    title: 'Kiểm toán viên',
    team: 'Nhóm Kiểm toán',
  },
  {
    email: 'thutien@demo.vn',
    fullName: 'Vũ Thị Mai',
    role: Role.CASHIER,
    title: 'Kế toán thu tiền',
  },
  {
    email: 'admin@demo.vn',
    fullName: 'Quản trị hệ thống',
    role: Role.ADMIN,
    title: 'IT',
  },
];

export async function seedUsers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const teamIds = new Map<string, string>();
  for (const name of ['Nhóm Thuế 1', 'Nhóm Kiểm toán']) {
    const team =
      (await prisma.team.findFirst({ where: { name } })) ??
      (await prisma.team.create({ data: { name } }));
    teamIds.set(name, team.id);
  }
  for (const u of DEMO_USERS) {
    const data = {
      fullName: u.fullName,
      role: u.role,
      title: u.title,
      teamId: u.team ? teamIds.get(u.team) : null,
    };
    await prisma.user.upsert({
      where: { email: u.email },
      update: data,
      create: { ...data, email: u.email, passwordHash },
    });
  }
}
