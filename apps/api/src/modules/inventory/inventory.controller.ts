import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { AdjustQuantityDto } from './dto/adjust-quantity.dto';

/** 库存管理：整个模块都要登录，没有 @Public() 标记的接口，见 auth 模块的全局 Guard */
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  /** 采购清单：库存低于安全库存的物品。放在 :id 之前，否则会被当成 id 匹配掉 */
  @Get('low-stock')
  findLowStock() {
    return this.inventoryService.findLowStock();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateStockItemDto) {
    return this.inventoryService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStockItemDto) {
    return this.inventoryService.update(id, dto);
  }

  @Post(':id/adjust')
  adjust(@Param('id') id: string, @Body() dto: AdjustQuantityDto) {
    return this.inventoryService.adjustQuantity(id, dto.delta);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
