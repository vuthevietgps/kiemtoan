import { Workbook } from 'exceljs';
import {
  CUSTOMER_COLUMNS,
  readCustomerWorkbook,
  writeCustomerWorkbook,
} from './customer-workbook.util';

describe('Customer workbook boundaries', () => {
  it('round-trips textual tax codes and phone numbers with leading zeros', async () => {
    const row = [
      'Example',
      '0012345678',
      '',
      '',
      '',
      'MONTHLY',
      'ACTIVE',
      '',
      '0900123456',
      '',
      '',
      '',
      // 06 (I5): năm tài chính, phương pháp GTGT, kỳ TNCN, chế độ kế toán, cơ quan thuế.
      '12',
      'DEDUCTION',
      'MONTHLY',
      'TT200',
      'Chi cục Thuế Quận 1',
    ];
    expect(
      await readCustomerWorkbook(await writeCustomerWorkbook([row], true)),
    ).toEqual([row]);
  });

  it('rejects numeric tax codes instead of silently losing leading zeros', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Khach hang');
    sheet.addRow([...CUSTOMER_COLUMNS]);
    sheet.addRow(['Example', 12345678]);
    await expect(
      readCustomerWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())),
    ).rejects.toThrow('MST và điện thoại');
  });

  it('rejects formulas and external hyperlinks', async () => {
    for (const value of [
      { formula: '1+1', result: 2 },
      { text: 'Contact', hyperlink: 'https://example.test' },
    ]) {
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet('Khach hang');
      sheet.addRow([...CUSTOMER_COLUMNS]);
      sheet.addRow(['Example', '0012345678', value]);
      await expect(
        readCustomerWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())),
      ).rejects.toThrow();
    }
  });

  it('rejects sparse sheets outside the allowed row range', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Khach hang');
    sheet.addRow([...CUSTOMER_COLUMNS]);
    sheet.getCell('A2002').value = 'Overflow';
    await expect(
      readCustomerWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())),
    ).rejects.toThrow();
  });

  it('rejects compressed files expanding beyond the limit before parsing', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Khach hang');
    sheet.addRow([...CUSTOMER_COLUMNS]);
    for (let index = 0; index < 700; index++)
      sheet.addRow(['x'.repeat(32760) + index, '0012345678']);
    await expect(
      readCustomerWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())),
    ).rejects.toThrow();
  });
});
