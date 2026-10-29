import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { ContractAmendmentsController } from './amendments/contract-amendments.controller';
import { ContractAmendmentsService } from './amendments/contract-amendments.service';
import { AuditBoardQuery } from './audit-engagements/audit-board.query';
import { AuditDeadlinesService } from './audit-engagements/audit-deadlines.service';
import { AuditEngagementsController } from './audit-engagements/audit-engagements.controller';
import { AuditEngagementsQuery } from './audit-engagements/audit-engagements.query';
import { AuditEngagementsService } from './audit-engagements/audit-engagements.service';
import { AuditNotesService } from './audit-engagements/audit-notes.service';
import { AuditPeopleQuery } from './audit-engagements/audit-people.query';
import { AuditTrackingController } from './audit-engagements/audit-tracking.controller';
import { ContractDossierService } from './audit-engagements/contract-dossier.service';
import {
  ContractDocumentsController,
  DocumentTemplatesController,
} from './commercial-documents/commercial-documents.controller';
import { ContractDocumentsService } from './commercial-documents/contract-documents.service';
import { DocumentTemplatesService } from './commercial-documents/document-templates.service';
import { ContractPlansController } from './contract-plans.controller';
import { ContractPlansService } from './contract-plans.service';
import { ContractsApprovalService } from './contracts-approval.service';
import { ContractsCommandService } from './contracts-command.service';
import { ContractsController } from './contracts.controller';
import { ContractsQueryService } from './contracts-query.service';
import { ContractLifecycleController } from './lifecycle/contract-lifecycle.controller';
import { ContractLifecycleService } from './lifecycle/contract-lifecycle.service';
import { ServiceTeamsController } from './service-teams/service-teams.controller';
import { ServiceTeamsService } from './service-teams/service-teams.service';

@Module({
  imports: [DocumentsModule],
  controllers: [
    // Trước ContractsController: /contracts/expiring không bị /contracts/:id bắt mất.
    ContractLifecycleController,
    AuditTrackingController,
    ContractsController,
    ContractPlansController,
    DocumentTemplatesController,
    ContractDocumentsController,
    ContractAmendmentsController,
    AuditEngagementsController,
    ServiceTeamsController,
  ],
  providers: [
    ContractsQueryService,
    ContractsCommandService,
    ContractsApprovalService,
    ContractPlansService,
    DocumentTemplatesService,
    ContractDocumentsService,
    ContractLifecycleService,
    ContractAmendmentsService,
    AuditEngagementsQuery,
    AuditEngagementsService,
    ContractDossierService,
    AuditDeadlinesService,
    AuditPeopleQuery,
    AuditBoardQuery,
    AuditNotesService,
    ServiceTeamsService,
  ],
  // 07-D3: thu tiền lập đề nghị thanh toán từ mẫu hồ sơ 04-C.
  exports: [ContractDocumentsService],
})
export class ContractsModule {}
