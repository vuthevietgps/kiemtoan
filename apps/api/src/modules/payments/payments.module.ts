import { Module } from '@nestjs/common';
import { ContractsModule } from '../contracts/contracts.module';
import { DocumentsModule } from '../documents/documents.module';
import { PaymentsController } from './payments.controller';
import { PaymentsQueryService } from './payments-query.service';
import { PaymentsService } from './payments.service';
import { ReceivablesQueryService } from './receivables-query.service';

@Module({
  // Chứng từ thu tiền lưu vào kho hồ sơ 02 qua DocumentsService (J8).
  imports: [DocumentsModule, ContractsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsQueryService, ReceivablesQueryService],
})
export class PaymentsModule {}
