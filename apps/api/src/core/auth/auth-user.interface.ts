import { Role } from '@prisma/client';

/** Người dùng đã đăng nhập, gắn vào request bởi JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  teamId: string | null;
  permissions?: readonly string[];
  dataScope?: 'ALL' | 'TEAM' | 'OWN' | 'NONE';
  sessionId?: string;
  mustChangePassword?: boolean;
  secretVerifiedAt?: Date | null;
  authVersion?: number;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  sid?: string;
}
