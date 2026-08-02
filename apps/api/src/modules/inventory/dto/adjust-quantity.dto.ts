import { IsNumber } from 'class-validator';

export class AdjustQuantityDto {
  /** 正数增加、负数减少；结果会被夹到不小于 0，见 InventoryService.adjustQuantity */
  @IsNumber()
  delta!: number;
}
