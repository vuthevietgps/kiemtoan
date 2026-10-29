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
  CreateServiceTypeDto,
  ServiceTypeQueryDto,
  UpdateServiceTypeDto,
} from './dto/service-type.dto';
import { ServiceCatalogService } from './service-catalog.service';

@ApiTags('service-catalog')
@ApiBearerAuth()
@Controller('service-types')
export class ServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get()
  @RequirePermission('service-catalog', 'view')
  findAll(@Query() query: ServiceTypeQueryDto) {
    return this.catalog.findAll(query);
  }

  @Get(':id')
  @RequirePermission('service-catalog', 'view')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.findOne(id);
  }

  @Post()
  @RequirePermission('service-catalog', 'create')
  create(@Body() dto: CreateServiceTypeDto) {
    return this.catalog.create(dto);
  }

  @Patch(':id')
  @RequirePermission('service-catalog', 'update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceTypeDto,
  ) {
    return this.catalog.update(user, id, dto);
  }
}
