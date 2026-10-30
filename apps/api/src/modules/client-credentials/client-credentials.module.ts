import { Module } from '@nestjs/common';
import { ClientCredentialsController } from './client-credentials.controller';
import { ClientCredentialsQueryService } from './client-credentials-query.service';
import { ClientCredentialsService } from './client-credentials.service';
import { CredentialSecretsService } from './credential-secrets.service';
import { CredentialStore } from './credential-store';
import { TokenCustodyService } from './token-custody.service';

@Module({
  controllers: [ClientCredentialsController],
  providers: [
    CredentialStore,
    ClientCredentialsQueryService,
    ClientCredentialsService,
    CredentialSecretsService,
    TokenCustodyService,
  ],
})
export class ClientCredentialsModule {}
