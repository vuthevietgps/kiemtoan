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
import { ClientCredentialsQueryService } from './client-credentials-query.service';
import { ClientCredentialsService } from './client-credentials.service';
import { CredentialSecretsService } from './credential-secrets.service';
import {
  BorrowTokenDto,
  ClientCredentialQueryDto,
  CreateClientCredentialDto,
  DeleteCredentialDto,
  HandOverTokenDto,
  ReportIssueDto,
  ReturnTokenDto,
  SecretRequestDto,
  TokenCustodyDto,
  UpdateClientCredentialDto,
} from './dto/client-credential.dto';
import { TokenCustodyService } from './token-custody.service';

const Id = () => Param('id', ParseUUIDPipe);

/** Kho tài khoản khách hàng và token chữ ký số (đặc tả 09; bảng Quyền). */
@ApiTags('client-credentials')
@ApiBearerAuth()
@Controller('client-credentials')
export class ClientCredentialsController {
  constructor(
    private readonly credentials: ClientCredentialsService,
    private readonly queries: ClientCredentialsQueryService,
    private readonly secrets: CredentialSecretsService,
    private readonly tokens: TokenCustodyService,
  ) {}

  @Get()
  @RequirePermission('client-credentials', 'view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ClientCredentialQueryDto,
  ) {
    return this.queries.findAll(user, query);
  }

  @Get(':id')
  @RequirePermission('client-credentials', 'view')
  findOne(@CurrentUser() user: AuthUser, @Id() id: string) {
    return this.queries.findOne(user, id);
  }

  /** L8: nhật ký xem / sao chép chỉ cho người quản lý kho. */
  @Get(':id/access-log')
  @RequirePermission('client-credentials', 'update')
  accessLog(@CurrentUser() user: AuthUser, @Id() id: string) {
    return this.queries.accessLog(user, id);
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
    @Id() id: string,
    @Body() dto: UpdateClientCredentialDto,
  ) {
    return this.credentials.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('client-credentials', 'delete')
  remove(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Body() dto: DeleteCredentialDto,
  ) {
    return this.credentials.remove(user, id, dto);
  }

  /** L6: xem (VIEW) hoặc sao chép (COPY) — mỗi lần một dòng nhật ký. */
  @Post(':id/secret')
  @HttpCode(200)
  @RequirePermission('client-credentials', 'view_secret')
  secret(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Body() dto: SecretRequestDto,
  ) {
    return this.secrets.secret(user, id, dto.purpose);
  }

  /** Bí danh cũ của `secret` VIEW — giữ đến khi giao diện 09-D chuyển hết sang `secret`. */
  @Post(':id/reveal')
  @HttpCode(200)
  @RequirePermission('client-credentials', 'view_secret')
  reveal(@CurrentUser() user: AuthUser, @Id() id: string) {
    return this.secrets.secret(user, id, 'VIEW');
  }

  @Post(':id/report-issue')
  @HttpCode(200)
  @RequirePermission('client-credentials', 'view')
  reportIssue(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Body() dto: ReportIssueDto,
  ) {
    return this.credentials.reportIssue(user, id, dto);
  }

  @Post(':id/borrow')
  @HttpCode(200)
  @RequirePermission('client-credentials', 'view')
  borrow(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Body() dto: BorrowTokenDto,
  ) {
    return this.tokens.borrow(user, id, dto);
  }

  @Post(':id/return')
  @HttpCode(200)
  @RequirePermission('client-credentials', 'view')
  returnToken(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Body() dto: ReturnTokenDto,
  ) {
    return this.tokens.returnToken(user, id, dto);
  }

  @Post(':id/hand-over')
  @HttpCode(200)
  @RequirePermission('client-credentials', 'update')
  handOver(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Body() dto: HandOverTokenDto,
  ) {
    return this.tokens.handOver(user, id, dto);
  }

  @Post(':id/custody')
  @HttpCode(200)
  @RequirePermission('client-credentials', 'update')
  setCustody(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Body() dto: TokenCustodyDto,
  ) {
    return this.tokens.setCustody(user, id, dto);
  }
}
