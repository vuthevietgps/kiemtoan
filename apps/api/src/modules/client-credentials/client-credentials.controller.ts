import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { ClientCredentialsService } from './client-credentials.service';
import {
  ClientCredentialQueryDto,
  CreateClientCredentialDto,
  UpdateClientCredentialDto,
} from './dto/client-credential.dto';

@ApiTags('client-credentials')
@ApiBearerAuth()
@Controller('client-credentials')
export class ClientCredentialsController {
  constructor(private readonly credentials: ClientCredentialsService) {}

  @Get()
  @RequirePermission('client-credentials', 'view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ClientCredentialQueryDto,
  ) {
    return this.credentials.findAll(user, query);
  }

  @Post()
  @RequirePermission('client-credentials', 'create')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClientCredentialDto,
  ) {
    return this.credentials.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('client-credentials', 'update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientCredentialDto,
  ) {
    return this.credentials.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('client-credentials', 'delete')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.credentials.remove(user, id);
  }

  @Post(':id/reveal')
  @HttpCode(200)
  @RequirePermission('client-credentials', 'view_secret')
  reveal(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.credentials.reveal(user, id);
  }
}
