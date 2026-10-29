import {
  Body,
  Controller,
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
import {
  CreateInvoiceDto,
  InvoiceQueryDto,
  IssueInvoiceDto,
} from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermission('invoices', 'view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: InvoiceQueryDto) {
    return this.invoices.findAll(user, query);
  }

  @Post()
  @RequirePermission('invoices', 'create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(user, dto);
  }

  @Patch(':id/issue')
  @RequirePermission('invoices', 'update')
  issue(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueInvoiceDto,
  ) {
    return this.invoices.issue(user, id, dto);
  }

  @Patch(':id/cancel')
  @RequirePermission('invoices', 'update')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoices.cancel(user, id);
  }
}
