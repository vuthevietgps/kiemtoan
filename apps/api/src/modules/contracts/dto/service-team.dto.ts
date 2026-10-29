import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { MAX_TEAM_ASSISTANTS } from '../service-teams/service-team.rules';

/** Nhóm thực hiện dòng dịch vụ kế toán (H8); thay cả đội hình, bỏ trống = không có. */
export class SaveServiceTeamDto {
  /** `revision` đọc từ GET; 0 khi nhóm chưa được lưu lần nào. */
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt({ message: 'Phiên bản nhóm không hợp lệ' })
  @Min(0)
  revision: number;

  @IsOptional()
  @IsUUID('all', { message: 'Manager không hợp lệ' })
  managerId?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'Trưởng nhóm không hợp lệ' })
  leadId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TEAM_ASSISTANTS, {
    message: `Tối đa ${MAX_TEAM_ASSISTANTS} trợ lý`,
  })
  @IsUUID('all', { each: true, message: 'Trợ lý không hợp lệ' })
  assistantIds?: string[];
}
