import { BillingCycle, PricingBasis, PrismaClient } from '@prisma/client';
import { seedWorkflow } from './workflow.seed';

interface ServiceSeed {
  code: string;
  name: string;
  cycle: BillingCycle;
  defaultPrice: string;
  description: string;
  /** [tên việc, số ngày sau cuối kỳ, cần bằng chứng] */
  templates: [string, number, boolean][];
}

const SERVICES: ServiceSeed[] = [
  {
    code: 'KTT',
    name: 'Kế toán thuế',
    cycle: BillingCycle.MONTHLY,
    defaultPrice: '3000000',
    description: 'Dịch vụ kế toán, kê khai thuế hằng tháng',
    templates: [
      ['Nhận chứng từ', 5, false],
      ['Nhập liệu', 12, false],
      ['Lập tờ khai GTGT', 18, true],
      ['Nộp tờ khai', 20, true],
      ['Gửi khách hàng xác nhận', 22, true],
    ],
  },
  {
    code: 'BCTC',
    name: 'Báo cáo tài chính',
    cycle: BillingCycle.YEARLY,
    defaultPrice: '15000000',
    description: 'Lập và nộp báo cáo tài chính năm, quyết toán thuế TNDN',
    templates: [
      ['Thu thập số liệu cả năm', 30, false],
      ['Rà soát sổ sách, bút toán điều chỉnh', 60, false],
      ['Lập báo cáo tài chính', 80, true],
      ['Lập tờ khai quyết toán thuế TNDN', 85, true],
      ['Nộp báo cáo và tờ khai quyết toán', 90, true],
    ],
  },
  {
    code: 'KT',
    name: 'Kiểm toán',
    cycle: BillingCycle.YEARLY,
    defaultPrice: '60000000',
    description: 'Kiểm toán báo cáo tài chính độc lập',
    templates: [
      ['Lập kế hoạch kiểm toán', 15, true],
      ['Kiểm toán tại đơn vị', 45, true],
      ['Lập dự thảo báo cáo kiểm toán', 60, true],
      ['Phát hành báo cáo kiểm toán', 80, true],
    ],
  },
  {
    code: 'CG',
    name: 'Chuyển giá',
    cycle: BillingCycle.YEARLY,
    defaultPrice: '50000000',
    description: 'Hồ sơ xác định giá giao dịch liên kết',
    templates: [
      ['Thu thập thông tin giao dịch liên kết', 20, false],
      ['Phân tích so sánh, chọn phương pháp', 50, true],
      ['Lập hồ sơ xác định giá giao dịch liên kết', 80, true],
      ['Lập phụ lục kê khai giao dịch liên kết', 90, true],
    ],
  },
  {
    code: 'HT',
    name: 'Hoàn thuế',
    cycle: BillingCycle.ONE_TIME,
    defaultPrice: '30000000',
    description: 'Lập hồ sơ đề nghị hoàn thuế GTGT',
    templates: [
      ['Rà soát điều kiện hoàn thuế', 7, false],
      ['Lập hồ sơ đề nghị hoàn thuế', 20, true],
      ['Nộp hồ sơ và theo dõi', 30, true],
      ['Làm việc với cơ quan thuế', 60, true],
    ],
  },
  {
    code: 'LLSS',
    name: 'Làm lại sổ sách',
    cycle: BillingCycle.ONE_TIME,
    defaultPrice: '20000000',
    description: 'Rà soát, làm lại sổ sách kế toán các năm trước',
    templates: [
      ['Thu thập chứng từ các năm', 10, false],
      ['Hạch toán lại sổ sách', 40, false],
      ['Đối chiếu số dư, công nợ', 50, true],
      ['Bàn giao sổ sách cho khách hàng', 60, true],
    ],
  },
];

/** Bảng giá mẫu cho môi trường dev: [từ, đến (null = không giới hạn), đơn giá]. Không phải giá thật. */
const SAMPLE_PRICE_LISTS: Record<
  string,
  {
    basis: PricingBasis;
    unit: string;
    tiers: [string, string | null, string][];
  }
> = {
  KTT: {
    basis: PricingBasis.DOCUMENT_COUNT,
    unit: 'chứng từ/tháng',
    tiers: [
      ['0', '100', '3000000'],
      ['100', '300', '4500000'],
      ['300', null, '6000000'],
    ],
  },
};

/** Tạo bảng giá mẫu áp dụng từ 01/01/2026 nếu dịch vụ chưa có bảng giá nào. */
async function seedPriceList(
  prisma: PrismaClient,
  serviceTypeId: string,
  code: string,
): Promise<void> {
  const sample = SAMPLE_PRICE_LISTS[code];
  if (!sample) return;
  await prisma.serviceType.update({
    where: { id: serviceTypeId },
    data: { pricingBasis: sample.basis, pricingUnit: sample.unit },
  });
  const count = await prisma.servicePriceList.count({
    where: { serviceTypeId },
  });
  if (count > 0) return;
  await prisma.servicePriceList.create({
    data: {
      serviceTypeId,
      effectiveFrom: new Date('2026-01-01'),
      pricingBasis: sample.basis,
      pricingUnit: sample.unit,
      note: 'Bảng giá mẫu cho môi trường dev',
      tiers: {
        createMany: {
          data: sample.tiers.map(([minValue, maxValue, unitPrice], i) => ({
            sortOrder: i + 1,
            minValue,
            maxValue,
            unitPrice,
          })),
        },
      },
    },
  });
}

/** Danh mục dịch vụ, bảng giá và quy trình mẫu. Chạy lại không lỗi: upsert theo mã, phần con chỉ tạo khi chưa có. */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  for (const s of SERVICES) {
    const data = {
      name: s.name,
      cycle: s.cycle,
      defaultPrice: s.defaultPrice,
      description: s.description,
      issuesAuditReport: s.code === 'KT',
    };
    const service = await prisma.serviceType.upsert({
      where: { code: s.code },
      update: data,
      create: { ...data, code: s.code },
    });
    await seedPriceList(prisma, service.id, s.code);
    await seedWorkflow(prisma, service, s.templates);
  }
}
