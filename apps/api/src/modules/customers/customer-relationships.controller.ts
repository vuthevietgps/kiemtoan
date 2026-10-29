import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { CustomerRelationshipsService } from './customer-relationships.service';
import {
  AssignCustomerDto,
  CreateContactDto,
  UpdateContactDto,
} from './dto/customer-relationship.dto';

@ApiTags('customer-relationships')
@ApiBearerAuth()
@Controller('customers/:customerId')
export class CustomerRelationshipsController {
  constructor(private readonly relationships: CustomerRelationshipsService) {}

  @Get('contacts')
  @RequirePermission('customers', 'view')
  contacts(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.relationships.contacts(user, customerId, query);
  }

  @Post('contacts')
  @RequirePermission('customers', 'update')
  createContact(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.relationships.saveContact(user, customerId, dto);
  }

  @Patch('contacts/:id')
  @RequirePermission('customers', 'update')
  updateContact(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.relationships.saveContact(user, customerId, dto, id);
  }

  @Delete('contacts/:id')
  @RequirePermission('customers', 'update')
  removeContact(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.relationships.removeContact(user, customerId, id);
  }

  @Get('assignments')
  @RequirePermission('customers', 'view')
  assignments(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.relationships.assignments(user, customerId, query);
  }

  @Post('assignments')
  @RequirePermission('customers', 'update')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: AssignCustomerDto,
  ) {
    return this.relationships.assign(user, customerId, dto);
  }

  @Delete('assignments/:id')
  @RequirePermission('customers', 'update')
  unassign(
    @CurrentUser() user: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.relationships.unassign(user, customerId, id);
  }
}
