import { ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryChannel, DeliveryStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class DeliveryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DeliveryStatus })
  @IsOptional()
  @IsEnum(DeliveryStatus, { message: 'Trạng thái gửi không hợp lệ' })
  status?: DeliveryStatus;

  @ApiPropertyOptional({ enum: DeliveryChannel })
  @IsOptional()
  @IsEnum(DeliveryChannel, { message: 'Kênh gửi không hợp lệ' })
  channel?: DeliveryChannel;
}

/** I10: tắt email thì vẫn nhận thông báo trong ứng dụng; tắt bản tin thì không nhận bản tin sáng. */
export class PreferencesDto {
  @IsBoolean({ message: 'Chọn bật hoặc tắt email' })
  emailEnabled: boolean;

  @IsBoolean({ message: 'Chọn bật hoặc tắt bản tin' })
  digestEnabled: boolean;
}

/** 'true' / 'false' trên query string → boolean. */
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;

/** 06-D4: chuông thông báo — chỉ thông báo chưa đọc. */
export class NotificationListQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'Giá trị lọc chưa đọc không hợp lệ' })
  unread?: boolean;
}
