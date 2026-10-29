import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto/crypto.service';
import { StorageService } from './storage/storage.service';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { FinancialFieldsInterceptor } from './access-control/financial-fields.interceptor';
import { PrismaErrorsFilter } from './prisma/prisma-errors.filter';

/** Dịch vụ hạ tầng dùng chung cho mọi module. */
@Global()
@Module({
  providers: [
    StorageService,
    CryptoService,
    { provide: APP_INTERCEPTOR, useClass: FinancialFieldsInterceptor },
    { provide: APP_FILTER, useClass: PrismaErrorsFilter },
  ],
  exports: [StorageService, CryptoService],
})
export class CoreModule {}
