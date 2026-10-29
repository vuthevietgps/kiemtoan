import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesQueryService } from './invoices-query.service';
import { InvoicesReconciliationService } from './invoices-reconciliation.service';
import { InvoicesService } from './invoices.service';

@Module({
  // File PDF/XML hoá đơn lưu vào kho hồ sơ 02 qua DocumentsService (08 K5).
  imports: [DocumentsModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoicesQueryService,
    InvoicesReconciliationService,
  ],
})
export class InvoicesModule {}
