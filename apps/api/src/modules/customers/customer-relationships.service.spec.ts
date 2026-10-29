import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { assertCustomerAssignee } from './customer-relationships.service';

describe('Customer assignee eligibility', () => {
  const user = { findFirst: jest.fn() };
  const manager: AuthUser = {
    id: 'manager',
    email: 'manager@example.test',
    fullName: 'Manager',
    role: Role.MANAGER,
    teamId: 'team-one',
  };
  beforeEach(() => jest.resetAllMocks());

  it('requires an active, non-deleted, non-departed person in the managed team', async () => {
    user.findFirst.mockResolvedValue({ id: 'staff' });
    await assertCustomerAssignee({ user }, manager, 'staff');
    expect(user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'staff',
        teamId: 'team-one',
        isActive: true,
        leftAt: null,
        deletedAt: null,
        role: { not: 'ADMIN' },
      },
      select: { id: true },
    });
  });

  it('rejects persons not found by the scoped eligibility query', async () => {
    user.findFirst.mockResolvedValue(null);
    await expect(
      assertCustomerAssignee({ user }, manager, 'other-team'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps a custom own scope from assigning other people', async () => {
    user.findFirst.mockResolvedValue({ id: manager.id });
    await expect(
      assertCustomerAssignee(
        { user },
        { ...manager, dataScope: 'OWN' },
        'other',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a director to select across teams while keeping status checks', async () => {
    user.findFirst.mockResolvedValue({ id: 'staff' });
    await assertCustomerAssignee(
      { user },
      { ...manager, role: Role.DIRECTOR },
      'staff',
    );
    expect(user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'staff',
        isActive: true,
        leftAt: null,
        deletedAt: null,
        role: { not: 'ADMIN' },
      },
      select: { id: true },
    });
  });
});
