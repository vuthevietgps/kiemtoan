import {
  CredentialStatus,
  CredentialType,
  CustomerStatus,
  PrismaClient,
  TaxPeriod,
} from '@prisma/client';
import { createCipheriv, randomBytes } from 'node:crypto';

/** Mã hoá giống CryptoService: base64(iv 12 byte | tag 16 byte | dữ liệu), AES-256-GCM. */
function encrypt(plain: string): string {
  const key = Buffer.from(process.env.CREDENTIAL_KEY ?? '', 'utf8');
  if (key.length !== 32)
    throw new Error('CREDENTIAL_KEY phải dài đúng 32 byte');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

interface CustomerSeed {
  name: string;
  taxCode: string;
  owner: string;
  address: string;
  legalRep: string;
  businessType: string;
  taxPeriod: TaxPeriod;
  status: CustomerStatus;
  contactName: string;
  contactPhone: string;
}

const CUSTOMERS: CustomerSeed[] = [
  {
    name: 'Công ty CP ABC',
    taxCode: '0101234567',
    owner: 'nhanvien1@demo.vn',
    address: '12 Láng Hạ, Đống Đa, Hà Nội',
    legalRep: 'Nguyễn Văn Hùng',
    businessType: 'Công ty cổ phần',
    taxPeriod: TaxPeriod.MONTHLY,
    status: CustomerStatus.ACTIVE,
    contactName: 'Chị Lan (kế toán)',
    contactPhone: '0912345678',
  },
  {
    name: 'Công ty TNHH XYZ',
    taxCode: '0102345678',
    owner: 'nhanvien1@demo.vn',
    address: '45 Trần Duy Hưng, Cầu Giấy, Hà Nội',
    legalRep: 'Trần Thị Hoa',
    businessType: 'Công ty TNHH',
    taxPeriod: TaxPeriod.QUARTERLY,
    status: CustomerStatus.ACTIVE,
    contactName: 'Anh Tuấn',
    contactPhone: '0987654321',
  },
  {
    name: 'Tập đoàn DEF',
    taxCode: '0103456789',
    owner: 'nhanvien3@demo.vn',
    address: '88 Nguyễn Huệ, Quận 1, TP.HCM',
    legalRep: 'Lê Minh Đức',
    businessType: 'Công ty cổ phần',
    taxPeriod: TaxPeriod.MONTHLY,
    status: CustomerStatus.ACTIVE,
    contactName: 'Chị Hạnh',
    contactPhone: '0903111222',
  },
  {
    name: 'Công ty TNHH GHI',
    taxCode: '0104567890',
    owner: 'nhanvien2@demo.vn',
    address: '5 Lê Lợi, Hải Châu, Đà Nẵng',
    legalRep: 'Phạm Quốc Bảo',
    businessType: 'Công ty TNHH',
    taxPeriod: TaxPeriod.QUARTERLY,
    status: CustomerStatus.ACTIVE,
    contactName: 'Anh Bảo',
    contactPhone: '0935222333',
  },
  {
    name: 'Công ty CP JKL',
    taxCode: '0105678901',
    owner: 'nhanvien2@demo.vn',
    address: '102 Kim Mã, Ba Đình, Hà Nội',
    legalRep: 'Hoàng Thị Mai',
    businessType: 'Công ty cổ phần',
    taxPeriod: TaxPeriod.MONTHLY,
    status: CustomerStatus.PAUSED,
    contactName: 'Chị Mai',
    contactPhone: '0916444555',
  },
  {
    name: 'Công ty TNHH MNO',
    taxCode: '0106789012',
    owner: 'nhanvien3@demo.vn',
    address: '27 Điện Biên Phủ, Bình Thạnh, TP.HCM',
    legalRep: 'Vũ Đình Nam',
    businessType: 'Công ty TNHH',
    taxPeriod: TaxPeriod.QUARTERLY,
    status: CustomerStatus.ACTIVE,
    contactName: 'Anh Nam',
    contactPhone: '0908666777',
  },
  {
    name: 'Hộ kinh doanh PQR',
    taxCode: '0107890123',
    owner: 'nhanvien1@demo.vn',
    address: '9 Hàng Bạc, Hoàn Kiếm, Hà Nội',
    legalRep: 'Đặng Văn Quý',
    businessType: 'Hộ kinh doanh',
    taxPeriod: TaxPeriod.QUARTERLY,
    status: CustomerStatus.PROSPECT,
    contactName: 'Anh Quý',
    contactPhone: '0977888999',
  },
  {
    name: 'Công ty CP STU',
    taxCode: '0108901234',
    owner: 'nhanvien2@demo.vn',
    address: '61 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
    legalRep: 'Bùi Thị Thu',
    businessType: 'Công ty cổ phần',
    taxPeriod: TaxPeriod.MONTHLY,
    status: CustomerStatus.STOPPED,
    contactName: 'Chị Thu',
    contactPhone: '0914000111',
  },
];

interface CredentialSeed {
  taxCode: string;
  type: CredentialType;
  label: string;
  url: string;
  username: string;
  password: string;
  expiresInDays?: number;
  status: CredentialStatus;
}

const CREDENTIALS: CredentialSeed[] = [
  {
    taxCode: '0101234567',
    type: CredentialType.TAX_PORTAL,
    label: 'Thuế điện tử',
    url: 'https://thuedientu.gdt.gov.vn',
    username: '0101234567',
    password: 'Abc@2025',
    status: CredentialStatus.ACTIVE,
  },
  {
    taxCode: '0101234567',
    type: CredentialType.DIGITAL_SIGNATURE,
    label: 'Token VNPT-CA',
    url: '',
    username: 'TOKEN-ABC-01',
    password: '12345678',
    expiresInDays: 20,
    status: CredentialStatus.ACTIVE,
  },
  {
    taxCode: '0102345678',
    type: CredentialType.SOCIAL_INSURANCE,
    label: 'BHXH điện tử',
    url: 'https://dichvucong.baohiemxahoi.gov.vn',
    username: 'xyz.bhxh',
    password: 'Xyz#Bhxh1',
    status: CredentialStatus.NEED_CHANGE,
  },
  {
    taxCode: '0103456789',
    type: CredentialType.E_INVOICE,
    label: 'Hoá đơn điện tử',
    url: 'https://hoadondientu.gdt.gov.vn',
    username: '0103456789',
    password: 'Def!Hd2025',
    status: CredentialStatus.ACTIVE,
  },
];

/** Dữ liệu demo cho module customers, client-credentials. Chạy lại nhiều lần không lỗi. */
export async function seedCustomers(prisma: PrismaClient): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { in: CUSTOMERS.map((c) => c.owner) } },
    select: { id: true, email: true },
  });
  const ownerOf = new Map(users.map((u) => [u.email, u.id]));
  const customerIds = new Map<string, string>();

  for (const { owner, ...c } of CUSTOMERS) {
    const data = { ...c, ownerId: ownerOf.get(owner) ?? null, deletedAt: null };
    const saved = await prisma.customer.upsert({
      where: { taxCode: c.taxCode },
      update: data,
      create: data,
    });
    customerIds.set(c.taxCode, saved.id);
    const contact = await prisma.customerContact.findFirst({
      where: { customerId: saved.id, deletedAt: null, isPrimary: true },
      select: { id: true },
    });
    if (!contact)
      await prisma.customerContact.create({
        data: {
          customerId: saved.id,
          fullName: c.contactName,
          phone: c.contactPhone,
          isPrimary: true,
        },
      });
  }

  for (const { taxCode, expiresInDays, password, ...cred } of CREDENTIALS) {
    const customerId = customerIds.get(taxCode);
    if (!customerId) continue;
    const exists = await prisma.clientCredential.findFirst({
      where: { customerId, type: cred.type, username: cred.username },
      select: { id: true },
    });
    if (exists) continue;
    const expiresAt =
      expiresInDays === undefined
        ? null
        : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    await prisma.clientCredential.create({
      data: {
        ...cred,
        url: cred.url || null,
        customerId,
        expiresAt,
        passwordEnc: encrypt(password),
      },
    });
  }
}
