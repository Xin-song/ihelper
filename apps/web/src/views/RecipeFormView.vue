<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, Delete, ArrowUp, ArrowDown } from '@element-plus/icons-vue';
import type {
  AmountType,
  IngredientDto,
  RecipeVisibility,
  VagueAmountLabel,
} from '@ihelper/shared';
import {
  RECIPE_VISIBILITIES,
  RECIPE_VISIBILITY_LABELS,
  VAGUE_AMOUNT_LABELS,
} from '@ihelper/shared';
import { recipesApi } from '../api/recipes';
import { useRecipesStore } from '../stores/recipes';
import IngredientPicker from '../components/IngredientPicker.vue';
import ImageUploader from '../components/ImageUploader.vue';

interface StepRow {
  body: string;
  imageUrl?: string;
  timerSeconds?: number;
}

interface IngredientRow {
  ingredientId: string;
  ingredientName?: string;
  amountType: AmountType;
  quantity?: number;
  unit?: string;
  vagueLabel?: VagueAmountLabel;
  note?: string;
  isOptional: boolean;
}

const route = useRoute();
const router = useRouter();
const store = useRecipesStore();

const isEdit = computed(() => Boolean(route.params.id));
const recipeId = computed(() => route.params.id as string | undefined);
const saving = ref(false);
const formRef = ref();

const form = reactive({
  title: '',
  coverImageUrl: '',
  description: '',
  category: '',
  tags: [] as string[],
  prepMinutes: undefined as number | undefined,
  cookMinutes: undefined as number | undefined,
  difficulty: undefined as number | undefined,
  servings: 2,
  source: '',
  visibility: 'private' as RecipeVisibility,
});

/** ImageUploader 统一按数组交互，封面只是 max=1 的特例 */
const coverImages = computed({
  get: () => (form.coverImageUrl ? [form.coverImageUrl] : []),
  set: (urls: string[]) => {
    form.coverImageUrl = urls[0] ?? '';
  },
});

const steps = ref<StepRow[]>([{ body: '' }]);
const ingredients = ref<IngredientRow[]>([
  { ingredientId: '', amountType: 'exact', isOptional: false },
]);

const rules = {
  title: [{ required: true, message: '请输入菜谱标题', trigger: 'blur' }],
  servings: [{ required: true, type: 'number', message: '请输入份数', trigger: 'blur' }],
};

async function loadForEdit() {
  if (!recipeId.value) return;
  const recipe = await recipesApi.get(recipeId.value);
  form.title = recipe.title;
  form.coverImageUrl = recipe.coverImageUrl ?? '';
  form.description = recipe.description ?? '';
  form.category = recipe.category ?? '';
  form.tags = [...recipe.tags];
  form.prepMinutes = recipe.prepMinutes ?? undefined;
  form.cookMinutes = recipe.cookMinutes ?? undefined;
  form.difficulty = recipe.difficulty ?? undefined;
  form.servings = recipe.servings;
  form.source = recipe.source ?? '';
  form.visibility = recipe.visibility;

  steps.value = recipe.steps.length
    ? recipe.steps.map((s) => ({ body: s.body, imageUrl: s.imageUrl, timerSeconds: s.timerSeconds }))
    : [{ body: '' }];

  ingredients.value = recipe.recipeIngredients.length
    ? recipe.recipeIngredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        ingredientName: ri.ingredient.name,
        amountType: ri.amountType,
        quantity: ri.quantity ?? undefined,
        unit: ri.unit ?? undefined,
        vagueLabel: ri.vagueLabel ?? undefined,
        note: ri.note ?? undefined,
        isOptional: ri.isOptional,
      }))
    : [{ ingredientId: '', amountType: 'exact', isOptional: false }];
}

onMounted(loadForEdit);

function addStep() {
  steps.value.push({ body: '' });
}
function removeStep(index: number) {
  steps.value.splice(index, 1);
}
function moveStep(index: number, dir: -1 | 1) {
  const target = index + dir;
  if (target < 0 || target >= steps.value.length) return;
  const [item] = steps.value.splice(index, 1);
  steps.value.splice(target, 0, item);
}

function addIngredientRow() {
  ingredients.value.push({ ingredientId: '', amountType: 'exact', isOptional: false });
}
function removeIngredientRow(index: number) {
  ingredients.value.splice(index, 1);
}
function handleIngredientSelect(row: IngredientRow, ingredient: IngredientDto) {
  row.ingredientName = ingredient.name;
  if (row.amountType === 'exact' && !row.unit) {
    row.unit = ingredient.defaultUnit;
  }
}
function handleAmountTypeChange(row: IngredientRow) {
  if (row.amountType === 'exact') {
    row.vagueLabel = undefined;
  } else {
    row.quantity = undefined;
    row.unit = undefined;
  }
}

async function handleSubmit() {
  await formRef.value?.validate();

  const cleanSteps = steps.value.filter((s) => s.body.trim().length > 0);
  const cleanIngredients = ingredients.value.filter((i) => i.ingredientId);

  if (cleanIngredients.some((i) => i.amountType === 'exact' && !i.quantity)) {
    ElMessage.warning('精确用量的配料需要填写数量');
    return;
  }
  if (cleanIngredients.some((i) => i.amountType === 'vague' && !i.vagueLabel)) {
    ElMessage.warning('模糊用量的配料需要选择「适量/少许/按口味」');
    return;
  }

  saving.value = true;
  try {
    const payload = {
      title: form.title.trim(),
      coverImageUrl: form.coverImageUrl.trim() || undefined,
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      tags: form.tags,
      prepMinutes: form.prepMinutes,
      cookMinutes: form.cookMinutes,
      difficulty: form.difficulty,
      servings: form.servings,
      source: form.source.trim() || undefined,
      visibility: form.visibility,
      steps: cleanSteps,
      ingredients: cleanIngredients.map((i) => ({
        ingredientId: i.ingredientId,
        amountType: i.amountType,
        quantity: i.amountType === 'exact' ? i.quantity : undefined,
        unit: i.amountType === 'exact' ? i.unit : undefined,
        vagueLabel: i.amountType === 'vague' ? i.vagueLabel : undefined,
        note: i.note?.trim() || undefined,
        isOptional: i.isOptional,
      })),
    };

    const saved = isEdit.value
      ? await recipesApi.update(recipeId.value!, payload)
      : await recipesApi.create(payload);

    store.invalidate();
    ElMessage.success(isEdit.value ? '已保存修改' : '菜谱已创建');
    router.push(`/recipes/${saved.id}`);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="ih-form-page">
    <h1 class="ih-heading ih-page-title">{{ isEdit ? '编辑菜谱' : '新建菜谱' }}</h1>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="ih-form">
      <section class="ih-card ih-form-section">
        <h2 class="ih-heading">基本信息</h2>
        <div class="ih-form-grid">
          <el-form-item label="标题" prop="title" class="ih-span-2">
            <el-input v-model="form.title" placeholder="如：番茄炒蛋" maxlength="120" />
          </el-form-item>
          <el-form-item label="封面图">
            <ImageUploader v-model="coverImages" :max="1" :size="120" hint="只用一张，列表和详情页的封面" />
          </el-form-item>
          <el-form-item label="分类">
            <el-input v-model="form.category" placeholder="如：家常菜" />
          </el-form-item>
          <el-form-item label="可见性" class="ih-span-2">
            <el-radio-group v-model="form.visibility">
              <el-radio v-for="v in RECIPE_VISIBILITIES" :key="v" :value="v">
                {{ RECIPE_VISIBILITY_LABELS[v] }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="标签" class="ih-span-2">
            <el-select
              v-model="form.tags"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="回车创建标签，如：快手、下饭"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="简介" class="ih-span-2">
            <el-input v-model="form.description" type="textarea" :rows="2" placeholder="一句话介绍这道菜" />
          </el-form-item>
          <el-form-item label="份数（基准）" prop="servings">
            <el-input-number v-model="form.servings" :min="0.5" :step="0.5" />
          </el-form-item>
          <el-form-item label="难度">
            <el-rate
              v-model="form.difficulty"
              :colors="['#e2622c', '#e2622c', '#e2622c']"
              void-color="#ece2d6"
            />
          </el-form-item>
          <el-form-item label="备料时长（分钟）">
            <el-input-number v-model="form.prepMinutes" :min="0" />
          </el-form-item>
          <el-form-item label="烹饪时长（分钟）">
            <el-input-number v-model="form.cookMinutes" :min="0" />
          </el-form-item>
          <el-form-item label="来源" class="ih-span-2">
            <el-input v-model="form.source" placeholder="链接 / 书名 / 「奶奶教的」" />
          </el-form-item>
        </div>
      </section>

      <section class="ih-card ih-form-section">
        <h2 class="ih-heading">配料表</h2>
        <div v-for="(row, index) in ingredients" :key="index" class="ih-ingredient-editor-row">
          <div class="ih-ingredient-editor-row__picker">
            <IngredientPicker
              v-model="row.ingredientId"
              @select="(ing) => handleIngredientSelect(row, ing)"
            />
          </div>
          <el-radio-group
            v-model="row.amountType"
            size="small"
            @change="() => handleAmountTypeChange(row)"
          >
            <el-radio-button value="exact">精确</el-radio-button>
            <el-radio-button value="vague">模糊</el-radio-button>
          </el-radio-group>

          <template v-if="row.amountType === 'exact'">
            <el-input-number v-model="row.quantity" :min="0" :step="0.5" size="small" style="width: 110px" />
            <el-input v-model="row.unit" placeholder="单位" size="small" style="width: 90px" />
          </template>
          <el-select v-else v-model="row.vagueLabel" placeholder="选择用量" size="small" style="width: 110px">
            <el-option v-for="l in VAGUE_AMOUNT_LABELS" :key="l" :value="l" :label="l" />
          </el-select>

          <el-input v-model="row.note" placeholder="备注，如「切丁」" size="small" style="width: 140px" />
          <el-checkbox v-model="row.isOptional">可选</el-checkbox>
          <el-button
            :icon="Delete"
            circle
            size="small"
            text
            type="danger"
            @click="removeIngredientRow(index)"
          />
        </div>
        <el-button :icon="Plus" text type="primary" @click="addIngredientRow">添加配料</el-button>
      </section>

      <section class="ih-card ih-form-section">
        <h2 class="ih-heading">步骤</h2>
        <div v-for="(step, index) in steps" :key="index" class="ih-step-editor-row">
          <span class="ih-step-editor-row__number">{{ index + 1 }}</span>
          <el-input
            v-model="step.body"
            type="textarea"
            :rows="2"
            :placeholder="`第 ${index + 1} 步做什么？`"
          />
          <el-input-number
            v-model="step.timerSeconds"
            :min="0"
            :step="60"
            size="small"
            placeholder="计时（秒）"
            style="width: 130px"
          />
          <div class="ih-step-editor-row__actions">
            <el-button :icon="ArrowUp" circle size="small" text @click="moveStep(index, -1)" />
            <el-button :icon="ArrowDown" circle size="small" text @click="moveStep(index, 1)" />
            <el-button :icon="Delete" circle size="small" text type="danger" @click="removeStep(index)" />
          </div>
        </div>
        <el-button :icon="Plus" text type="primary" @click="addStep">添加步骤</el-button>
      </section>

      <div class="ih-form-footer">
        <el-button @click="router.back()">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '创建菜谱' }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.ih-page-title {
  font-size: 26px;
  margin: 0 0 20px;
}

.ih-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ih-form-section {
  padding: 22px 24px;
}

.ih-form-section h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

.ih-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 20px;
}

.ih-span-2 {
  grid-column: span 2;
}

.ih-ingredient-editor-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.ih-ingredient-editor-row__picker {
  width: 200px;
  flex-shrink: 0;
}

.ih-step-editor-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.ih-step-editor-row__number {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--ih-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  margin-top: 6px;
}

.ih-step-editor-row__actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ih-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-bottom: 20px;
}
</style>
