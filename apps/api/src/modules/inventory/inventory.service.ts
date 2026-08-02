import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_SPACE_ID } from '@ihelper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';

/** Prisma 的 Decimal 字段序列化成 JSON 时默认是字符串，这里统一转成 number */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'object' && 'toNumber' in (value as object)
    ? (value as { toNumber(): number }).toNumber()
    : Number(value);
}

type RawStockItem = {
  quantity: unknown;
  safetyStock: unknown;
  [key: string]: unknown;
};

/** isLowStock 是纯派生字段：低于安全库存就算，采购清单直接按这个过滤，不单独建表 */
function serialize<T extends RawStockItem>(item: T) {
  const quantity = toNumber(item.quantity) ?? 0;
  const safetyStock = toNumber(item.safetyStock);
  return {
    ...item,
    quantity,
    safetyStock,
    isLowStock: safetyStock !== null && quantity < safetyStock,
  };
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.stockItem.findMany({
      where: { spaceId: DEFAULT_SPACE_ID, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return items.map(serialize);
  }

  /** 采购清单：库存低于安全库存的物品 */
  async findLowStock() {
    const items = await this.findAll();
    return items.filter((item) => item.isLowStock);
  }

  async findOne(id: string) {
    return serialize(await this.assertExists(id));
  }

  async create(dto: CreateStockItemDto) {
    const created = await this.prisma.stockItem.create({
      data: {
        spaceId: DEFAULT_SPACE_ID,
        name: dto.name,
        category: dto.category,
        quantity: dto.quantity,
        unit: dto.unit,
        safetyStock: dto.safetyStock,
        note: dto.note,
      },
    });
    return serialize(created);
  }

  async update(id: string, dto: UpdateStockItemDto) {
    await this.assertExists(id);
    const updated = await this.prisma.stockItem.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        quantity: dto.quantity,
        unit: dto.unit,
        safetyStock: dto.safetyStock,
        note: dto.note,
      },
    });
    return serialize(updated);
  }

  /**
   * +/- 按钮走这个：读出当前数量、加上 delta、夹到不小于 0 再写回。
   * 单用户自托管场景不需要处理并发竞争，没有做成原子的数据库层加减。
   */
  async adjustQuantity(id: string, delta: number) {
    const current = await this.assertExists(id);
    const next = Math.max(0, (toNumber(current.quantity) ?? 0) + delta);
    const updated = await this.prisma.stockItem.update({
      where: { id },
      data: { quantity: next },
    });
    return serialize(updated);
  }

  async remove(id: string) {
    await this.assertExists(id);
    return this.prisma.stockItem.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  }

  private async assertExists(id: string) {
    const found = await this.prisma.stockItem.findFirst({
      where: { id, spaceId: DEFAULT_SPACE_ID, deletedAt: null },
    });
    if (!found) throw new NotFoundException(`库存物品 ${id} 不存在`);
    return found;
  }
}
