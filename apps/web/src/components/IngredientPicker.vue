<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { IngredientDto } from '@ihelper/shared';
import { INGREDIENT_CATEGORIES, INGREDIENT_CATEGORY_LABELS } from '@ihelper/shared';
import { ingredientsApi } from '../api/ingredients';

const props = defineProps<{ modelValue?: string }>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
  select: [ingredient: IngredientDto];
}>();

const options = ref<IngredientDto[]>([]);
const loading = ref(false);
const lastQuery = ref('');

async function search(query: string) {
  lastQuery.value = query;
  loading.value = true;
  try {
    options.value = await ingredientsApi.list(query || undefined);
  } finally {
    loading.value = false;
  }
}

// 初次打开时先加载全部，方便直接下拉挑选常用食材
search('');

function handleChange(id: string) {
  const found = options.value.find((o) => o.id === id);
  if (found) emit('select', found);
}

const createDialogVisible = ref(false);
const createForm = ref({ name: '', category: 'other' as (typeof INGREDIENT_CATEGORIES)[number], defaultUnit: '' });

watch(createDialogVisible, (visible) => {
  if (visible) {
    createForm.value = { name: lastQuery.value, category: 'other', defaultUnit: '' };
  }
});

async function submitCreate() {
  if (!createForm.value.name.trim() || !createForm.value.defaultUnit.trim()) {
    ElMessage.warning('请填写食材名称和默认单位');
    return;
  }
  const created = await ingredientsApi.create({
    name: createForm.value.name.trim(),
    category: createForm.value.category,
    defaultUnit: createForm.value.defaultUnit.trim(),
  });
  options.value = [created, ...options.value];
  emit('update:modelValue', created.id);
  emit('select', created);
  createDialogVisible.value = false;
  ElMessage.success(`已创建食材「${created.name}」`);
}
</script>

<template>
  <div class="ih-ingredient-picker">
    <el-select
      :model-value="props.modelValue"
      filterable
      remote
      reserve-keyword
      placeholder="搜索食材"
      :remote-method="search"
      :loading="loading"
      style="width: 100%"
      @update:model-value="(v: string) => emit('update:modelValue', v)"
      @change="handleChange"
    >
      <el-option v-for="opt in options" :key="opt.id" :value="opt.id" :label="opt.name">
        <span>{{ opt.name }}</span>
        <span class="ih-muted" style="float: right; font-size: 12px">
          {{ INGREDIENT_CATEGORY_LABELS[opt.category] }}
        </span>
      </el-option>
      <template #footer>
        <el-button text type="primary" size="small" @click="createDialogVisible = true">
          + 没找到？创建新食材
        </el-button>
      </template>
    </el-select>

    <el-dialog v-model="createDialogVisible" title="快速创建食材" width="380px" append-to-body>
      <el-form label-width="70px" label-position="left">
        <el-form-item label="名称">
          <el-input v-model="createForm.name" placeholder="如：鸡蛋" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="createForm.category" style="width: 100%">
            <el-option
              v-for="c in INGREDIENT_CATEGORIES"
              :key="c"
              :value="c"
              :label="INGREDIENT_CATEGORY_LABELS[c]"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="默认单位">
          <el-input v-model="createForm.defaultUnit" placeholder="如：个 / g / ml" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建并使用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ih-ingredient-picker {
  width: 100%;
}
</style>
