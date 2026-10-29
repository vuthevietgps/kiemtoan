import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { DocumentsService } from './documents.service';

let service: DocumentsService;
const prisma = {
  customer: { findFirst: jest.fn() },
  contract: { findFirst: jest.fn() },
  document: { findFirst: jest.fn(), create: jest.fn() },
};
const storage = { save: jest.fn(), pathOf: jest.fn(), remove: jest.fn() };
const user: AuthUser = {
  id: 'u1',
  email: 'u@demo.vn',
  fullName: 'U',
  role: Role.STAFF,
  teamId: null,
};
const file = {
  originalname: 'a.pdf',
  mimetype: 'application/pdf',
  size: 15,
  buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
};

beforeEach(async () => {
  jest.resetAllMocks();
  const moduleRef = await Test.createTestingModule({
    providers: [
      DocumentsService,
      { provide: PrismaService, useValue: prisma },
      { provide: StorageService, useValue: storage },
    ],
  }).compile();
  service = moduleRef.get(DocumentsService);
});

it('bắt buộc có file', async () => {
  await expect(
    service.upload(user, 'c1', undefined, { category: 'LEGAL' }),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('không cho gắn hợp đồng của khách hàng khác', async () => {
  prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });
  prisma.contract.findFirst.mockResolvedValue(null);
  await expect(
    service.upload(user, 'c1', file, {
      category: 'CONTRACT',
      contractId: 'k9',
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(storage.save).not.toHaveBeenCalled();
});

it('lưu file rồi tạo bản ghi với người tải lên', async () => {
  prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });
  storage.save.mockResolvedValue({
    fileName: 'a.pdf',
    storedName: '2025/10/x.pdf',
    mimeType: 'application/pdf',
    size: 3,
  });
  prisma.document.create.mockResolvedValue({ id: 'd1' });
  await service.upload(user, 'c1', file, { category: 'LEGAL' });
  const { data } = (prisma.document.create.mock.calls as unknown[][])[0][0] as {
    data: unknown;
  };
  expect(data).toMatchObject({ customerId: 'c1', uploadedById: 'u1' });
});

it('tải tài liệu ngoài phạm vi trả 404', async () => {
  prisma.document.findFirst.mockResolvedValue(null);
  await expect(service.fileOf(user, 'd9')).rejects.toBeInstanceOf(
    NotFoundException,
  );
});

it('removes the newly stored file when database insertion fails', async () => {
  prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });
  storage.save.mockResolvedValue({
    fileName: 'a.pdf',
    storedName: '2026/10/new.pdf',
    mimeType: 'application/pdf',
    size: 15,
  });
  const error = new Error('Database failure');
  prisma.document.create.mockRejectedValue(error);
  await expect(
    service.upload(user, 'c1', file, { category: 'LEGAL' }),
  ).rejects.toBe(error);
  expect(storage.remove).toHaveBeenCalledWith('2026/10/new.pdf');
});
