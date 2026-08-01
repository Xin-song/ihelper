import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_SPACE_ID } from '@ihelper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: string) {
    if (!query) {
      return this.prisma.ingredient.findMany({
        where: { spaceId: DEFAULT_SPACE_ID, deletedAt: null },
        orderBy: { name: 'asc' },
      });
    }

    const like = `%${query}%`;
    return this.prisma.$queryRaw`
      SELECT
        id,
        space_id AS "spaceId",
        name,
        aliases,
        category,
        default_unit AS "defaultUnit",
        note,
        merged_into_id AS "mergedIntoId",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
      FROM ingredients
      WHERE space_id = ${DEFAULT_SPACE_ID}::uuid
        AND deleted_at IS NULL
        AND (
          name ILIKE ${like}
          OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE a ILIKE ${like})
        )
      ORDER BY name ASC
    `;
  }

  async findOne(id: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id, spaceId: DEFAULT_SPACE_ID, deletedAt: null },
    });
    if (!ingredient) {
      throw new NotFoundException(`食材 ${id} 不存在`);
    }
    return ingredient;
  }

  async create(dto: CreateIngredientDto) {
    try {
      return await this.prisma.ingredient.create({
        data: {
          spaceId: DEFAULT_SPACE_ID,
          name: dto.name,
          category: dto.category,
          defaultUnit: dto.defaultUnit,
          aliases: dto.aliases ?? [],
          note: dto.note,
        },
      });
    } catch (err) {
      throw this.mapUniqueViolation(err, dto.name);
    }
  }

  async update(id: string, dto: UpdateIngredientDto) {
    await this.findOne(id);
    try {
      return await this.prisma.ingredient.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category,
          defaultUnit: dto.defaultUnit,
          aliases: dto.aliases,
          note: dto.note,
        },
      });
    } catch (err) {
      throw this.mapUniqueViolation(err, dto.name);
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.ingredient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private mapUniqueViolation(err: unknown, name?: string) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException(`食材「${name}」已存在`);
    }
    return err;
  }
}
