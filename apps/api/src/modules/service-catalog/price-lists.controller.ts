import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import {
  CurrentUser,
  RequirePermission,
} from '../../core/auth/decorators/auth.decorators';
import { PriceListDto, PriceQuoteQueryDto } from './dto/price-list.dto';
import { PriceListsService } from './price-lists.service';

/** Bảng giá và báo giá của một dịch vụ; service kiểm tra thêm quyền tài chính. */
@ApiTags('service-catalog')
@ApiBearerAuth()
@Controller('service-types/:serviceTypeId')
export class PriceListsController {
  constructor(private readonly priceLists: PriceListsService) {}

  @Get('price-lists')
  @RequirePermission('service-catalog', 'view')
  list(
    @CurrentUser() user: AuthUser,
    @Param('serviceTypeId', ParseUUIDPipe) serviceTypeId: string,
  ) {
    return this.priceLists.list(user, serviceTypeId);
  }

  @Post('price-lists')
  @RequirePermission('service-catalog', 'update')
  create(
    @CurrentUser() user: AuthUser,
    @Param('serviceTypeId', ParseUUIDPipe) serviceTypeId: string,
    @Body() dto: PriceListDto,
  ) {
    return this.priceLists.create(user, serviceTypeId, dto);
  }

  @Put('price-lists/:id')
  @RequirePermission('service-catalog', 'update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('serviceTypeId', ParseUUIDPipe) serviceTypeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PriceListDto,
  ) {
    return this.priceLists.update(user, serviceTypeId, id, dto);
  }

  @Delete('price-lists/:id')
  @RequirePermission('service-catalog', 'update')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('serviceTypeId', ParseUUIDPipe) serviceTypeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.priceLists.remove(user, serviceTypeId, id);
  }

  @Get('price-quote')
  @RequirePermission('service-catalog', 'view')
  quote(
    @CurrentUser() user: AuthUser,
    @Param('serviceTypeId', ParseUUIDPipe) serviceTypeId: string,
    @Query() query: PriceQuoteQueryDto,
  ) {
    return this.priceLists.quote(user, serviceTypeId, query);
  }
}
