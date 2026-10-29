import { Module } from '@nestjs/common';
import { ClientCredentialsController } from './client-credentials.controller';
import { ClientCredentialsService } from './client-credentials.service';

@Module({
  controllers: [ClientCredentialsController],
  providers: [ClientCredentialsService],
})
export class ClientCredentialsModule {}
