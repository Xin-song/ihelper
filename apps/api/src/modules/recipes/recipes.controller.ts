import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreatePrintImageDto } from './dto/create-print-image.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  findAll() {
    return this.recipesService.findAll();
  }

  /** 菜谱广场。放在 :id 之前，否则 'square' 会被当成 id 匹配掉 */
  @Get('square')
  findPublic() {
    return this.recipesService.findPublic();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recipesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRecipeDto) {
    return this.recipesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecipeDto) {
    return this.recipesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.recipesService.remove(id);
  }

  @Post(':id/print-images')
  addPrintImage(@Param('id') id: string, @Body() dto: CreatePrintImageDto) {
    return this.recipesService.addPrintImage(id, dto);
  }

  @Delete(':id/print-images/:imageId')
  removePrintImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.recipesService.removePrintImage(id, imageId);
  }
}
