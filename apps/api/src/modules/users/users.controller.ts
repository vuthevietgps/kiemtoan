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
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('users', 'view')
  findAll(@Query() query: UserQueryDto, @CurrentUser() actor: AuthUser) {
    return this.users.findAll(query, actor);
  }

  /** Mọi người dùng đã đăng nhập đều cần để chọn người phụ trách. */
  @Get('options')
  options(@CurrentUser() actor: AuthUser) {
    return this.users.options(actor);
  }

  @Get('teams')
  teams(@CurrentUser() actor: AuthUser) {
    return this.users.teams(actor);
  }

  @Get(':id')
  @RequirePermission('users', 'view')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.findOne(id, actor);
  }

  @Post()
  @RequirePermission('users', 'create')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermission('users', 'update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Patch(':id/lock')
  @RequirePermission('users', 'update')
  lock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    return this.users.setActive(id, false, me.id, me);
  }

  @Patch(':id/unlock')
  @RequirePermission('users', 'update')
  unlock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    return this.users.setActive(id, true, me.id, me);
  }
}
