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
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission('customers', 'view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: CustomerQueryDto) {
    return this.customers.findAll(user, query);
  }

  @Get('options')
  @RequirePermission('customers', 'view')
  options(@CurrentUser() user: AuthUser) {
    return this.customers.options(user);
  }

  @Get('assignee-options')
  @RequirePermission('customers', 'update')
  assigneeOptions(
    @CurrentUser() user: AuthUser,
    @Query() query: CustomerQueryDto,
  ) {
    return this.customers.assigneeOptions(user, query);
  }

  @Get(':id')
  @RequirePermission('customers', 'view')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customers.findOne(user, id);
  }

  @Post()
  @RequirePermission('customers', 'create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('customers', 'update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('customers', 'delete')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customers.remove(user, id);
  }
}
