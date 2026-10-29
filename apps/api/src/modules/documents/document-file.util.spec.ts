import { validateDocumentFile } from './document-file.util';
import type { UploadedFileInfo } from '../../core/storage/storage.service';
import { writeCustomerWorkbook } from '../customers/customer-workbook.util';

describe('Document upload content checks', () => {
  const file = (originalname: string, buffer: Buffer): UploadedFileInfo => ({
    originalname,
    buffer,
    mimetype: 'text/html',
    size: buffer.length,
  });
  it('uses the canonical MIME instead of trusting the uploaded MIME', () => {
    expect(
      validateDocumentFile(file('report.pdf', Buffer.from('%PDF-1.4\n%%EOF')))
        .mimetype,
    ).toBe('application/pdf');
  });
  it('rejects forbidden types, false signatures and path names', () => {
    for (const name of [
      'file.svg',
      'file.html',
      'file.exe',
      '../file.pdf',
      'file.pdf',
    ]) {
      expect(() =>
        validateDocumentFile(file(name, Buffer.from('<html>payload</html>'))),
      ).toThrow();
    }
  });
  it('accepts a bounded, macro-free Office workbook and rejects an invalid archive', async () => {
    expect(
      validateDocumentFile(
        file('customers.xlsx', await writeCustomerWorkbook([])),
      ).mimetype,
    ).toContain('spreadsheetml');
    expect(() =>
      validateDocumentFile(file('customers.xlsx', Buffer.from('PK-invalid'))),
    ).toThrow();
  });
});
