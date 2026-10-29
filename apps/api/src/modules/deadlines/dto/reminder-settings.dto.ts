import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ServiceThresholdsDto {
  /** [Sắp đến hạn, Cần ưu tiên, Gần đến hạn] — số ngày, giảm dần. */
  @IsArray({ message: 'Ngưỡng mức gấp gồm 3 số ngày' })
  @ArrayMaxSize(3)
  @IsInt({ each: true, message: 'Ngưỡng phải là số ngày nguyên' })
  thresholds: number[];
}

export class ReminderSettingsDto extends ServiceThresholdsDto {
  @IsInt()
  @Min(1)
  revision: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Giờ gửi dạng HH:mm (giờ Việt Nam)',
  })
  sendTime: string;

  @IsInt({ message: 'Số ngày leo thang phải là số nguyên' })
  @Min(1, { message: 'Số ngày leo thang từ 1 đến 30' })
  @Max(30, { message: 'Số ngày leo thang từ 1 đến 30' })
  escalationWorkingDays: number;
}
