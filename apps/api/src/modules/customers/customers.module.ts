import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerRelationshipsController } from './customer-relationships.controller';
import { CustomerRelationshipsService } from './customer-relationships.service';
import { CustomerImportController } from './customer-import.controller';
import { CustomerImportService } from './customer-import.service';

@Module({
  controllers: [
    CustomerImportController,
    CustomerRelationshipsController,
    CustomersController,
  ],
  providers: [
    CustomersService,
    CustomerRelationshipsService,
    CustomerImportService,
  ],
})
export class CustomersModule {}
