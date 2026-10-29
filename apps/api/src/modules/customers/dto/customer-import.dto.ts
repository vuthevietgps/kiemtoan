import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class ConfirmCustomerImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(2, { each: true })
  rows: number[];
}
