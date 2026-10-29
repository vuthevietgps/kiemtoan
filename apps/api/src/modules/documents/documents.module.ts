import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
  // Hợp đồng (04-C) lưu hồ sơ sinh từ mẫu và bản scan đã ký vào kho hồ sơ.
  exports: [DocumentsService],
})
export class DocumentsModule {}
