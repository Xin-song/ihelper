import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreatePrintImageDto } from './dto/create-print-image.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Public()
  @Get()
  findAll() {
    return this.recipesService.findAll();
  }

  /** 菜谱广场。放在 :id 之前，否则 'square' 会被当成 id 匹配掉 */
  @Public()
  @Get('square')
  findPublic() {
    return this.recipesService.findPublic();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recipesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRecipeDto, @CurrentUser() user: RequestUser) {
    return this.recipesService.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecipeDto, @CurrentUser() user: RequestUser) {
    return this.recipesService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.recipesService.remove(id, user.id);
  }

  @Post(':id/print-images')
  addPrintImage(
    @Param('id') id: string,
    @Body() dto: CreatePrintImageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.recipesService.addPrintImage(id, dto, user.id);
  }

  @Delete(':id/print-images/:imageId')
  removePrintImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.recipesService.removePrintImage(id, imageId, user.id);
  }
}
