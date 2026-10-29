import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../../core/auth/auth.module';
import { UserAccessService } from './user-access.service';
import { UserManagementController } from './user-management.controller';

@Module({
  imports: [AuthModule],
  controllers: [UserManagementController, UsersController],
  providers: [UsersService, UserAccessService],
  exports: [UsersService],
})
export class UsersModule {}
