import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentRequestsController } from './document-requests.controller';
import { DocumentRequestsService } from './document-requests.service';
import { MyTasksQuery } from './my-tasks.query';
import { TaskAccess } from './task-access';
import { TaskCommentsService } from './task-comments.service';
import { TaskFollowUpController } from './task-follow-up.controller';
import { TaskFollowUpService } from './task-follow-up.service';
import { TaskObligationDuesListener } from './task-obligation-dues.listener';
import { TaskWorkflowService } from './task-workflow.service';
import { TasksQueryService } from './tasks-query.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  // 05-D: file hồ sơ khách nộp lưu vào kho hồ sơ 02 qua DocumentsService.
  imports: [DocumentsModule],
  controllers: [
    TasksController,
    TaskFollowUpController,
    DocumentRequestsController,
  ],
  providers: [
    TasksService,
    TasksQueryService,
    TaskAccess,
    TaskWorkflowService,
    TaskFollowUpService,
    DocumentRequestsService,
    MyTasksQuery,
    TaskCommentsService,
    TaskObligationDuesListener,
  ],
})
export class TasksModule {}
