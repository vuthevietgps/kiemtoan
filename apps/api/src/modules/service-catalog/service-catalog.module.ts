import { Module } from '@nestjs/common';
import { PriceListsController } from './price-lists.controller';
import { PriceListsService } from './price-lists.service';
import { ServiceCatalogController } from './service-catalog.controller';
import { ServiceCatalogService } from './service-catalog.service';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowVersionsService } from './workflow-versions.service';
import { WorkflowController } from './workflow.controller';

@Module({
  controllers: [
    ServiceCatalogController,
    PriceListsController,
    WorkflowController,
  ],
  providers: [
    ServiceCatalogService,
    PriceListsService,
    WorkflowTemplatesService,
    WorkflowVersionsService,
  ],
})
export class ServiceCatalogModule {}
