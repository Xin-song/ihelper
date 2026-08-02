<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Minus } from '@element-plus/icons-vue';
import type { StockItemDto } from '@ihelper/shared';
import { INGREDIENT_CATEGORIES, INGREDIENT_CATEGORY_LABELS } from '@ihelper/shared';
import { inventoryApi } from '../api/inventory';

const items = ref<StockItemDto[]>([]);
const loading = ref(true);
const activeTab = ref<'all' | 'low'>('all');

async function load() {
  loading.value = true;
  try {
    items.value = await inventoryApi.list();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const lowStockItems = computed(() => items.value.filter((item) => item.isLowStock));
const visibleItems = computed(() => (activeTab.value === 'low' ? lowStockItems.value : items.value));

const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const submitting = ref(false);
const form = reactive({
  name: '',
  category: 'other' as (typeof INGREDIENT_CATEGORIES)[number],
  quantity: 0,
  unit: '',
  safetyStock: undefined as number | undefined,
  note: '',
});

function resetForm() {
  form.name = '';
  form.category = 'other';
  form.quantity = 0;
  form.unit = '';
  form.safetyStock = undefined;
  form.note = '';
}

function openCreate() {
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(item: StockItemDto) {
  editingId.value = item.id;
  form.name = item.name;
  form.category = item.category;
  form.quantity = item.quantity;
  form.unit = item.unit;
  form.safetyStock = item.safetyStock ?? undefined;
  form.note = item.note ?? '';
  dialogVisible.value = true;
}

async function submit() {
  if (!form.name.trim() || !form.unit.trim()) {
    ElMessage.warning('名称和单位不能为空');
    return;
  }
  submitting.value = true;
  const payload = {
    name: form.name.trim(),
    category: form.category,
    quantity: form.quantity,
    unit: form.unit.trim(),
    safetyStock: form.safetyStock,
    note: form.note.trim() || undefined,
  };
  try {
    if (editingId.value) {
      const updated = await inventoryApi.update(editingId.value, payload);
      const idx = items.value.findIndex((i) => i.id === editingId.value);
      if (idx !== -1) items.value[idx] = updated;
      ElMessage.success('已保存');
    } else {
      const created = await inventoryApi.create(payload);
      items.value = [created, ...items.value];
      ElMessage.success('已添加');
    }
    dialogVisible.value = false;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    submitting.value = false;
  }
}

async function adjust(item: StockItemDto, delta: number) {
  try {
    const updated = await inventoryApi.adjust(item.id, delta);
    const idx = items.value.findIndex((i) => i.id === item.id);
    if (idx !== -1) items.value[idx] = updated;
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

async function remove(item: StockItemDto) {
  try {
    await ElMessageBox.confirm(`确定删除「${item.name}」吗？`, '删除库存物品', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await inventoryApi.remove(item.id);
    items.value = items.value.filter((i) => i.id !== item.id);
    ElMessage.success('已删除');
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
</script>

<template>
  <div>
    <div class="ih-page-header">
      <div>
        <h1 class="ih-heading ih-page-title">库存管理</h1>
        <p class="ih-muted">
          {{ items.length }} 件物品，{{ lowStockItems.length }} 件低于安全库存
        </p>
      </div>
      <el-button type="primary" round :icon="Plus" @click="openCreate">添加物品</el-button>
    </div>

    <el-tabs v-model="activeTab" class="ih-inventory-tabs">
      <el-tab-pane label="全部库存" name="all" />
      <el-tab-pane name="low">
        <template #label>
          采购清单
          <el-badge v-if="lowStockItems.length" :value="lowStockItems.length" class="ih-inventory-tabs__badge" />
        </template>
      </el-tab-pane>
    </el-tabs>

    <div v-if="loading" class="ih-inventory-list">
      <div v-for="i in 4" :key="i" class="ih-skeleton ih-card"></div>
    </div>

    <el-empty
      v-else-if="visibleItems.length === 0"
      :description="activeTab === 'low' ? '没有库存不足的物品' : '还没有库存物品，先添加第一件吧'"
      class="ih-empty"
    />

    <div v-else class="ih-inventory-list">
      <div
        v-for="item in visibleItems"
        :key="item.id"
        class="ih-inventory-row ih-card"
        :class="{ 'ih-inventory-row--low': item.isLowStock }"
      >
        <div class="ih-inventory-row__main">
          <span class="ih-inventory-row__name">{{ item.name }}</span>
          <span class="ih-chip ih-chip--muted">{{ INGREDIENT_CATEGORY_LABELS[item.category] }}</span>
          <span v-if="item.isLowStock" class="ih-chip ih-inventory-row__warn">库存不足</span>
        </div>

        <div class="ih-inventory-row__quantity">
          <el-button circle size="small" :icon="Minus" @click="adjust(item, -1)" />
          <span class="ih-inventory-row__amount">{{ item.quantity }} {{ item.unit }}</span>
          <el-button circle size="small" :icon="Plus" @click="adjust(item, 1)" />
        </div>

        <div class="ih-inventory-row__safety ih-muted">
          安全库存：{{ item.safetyStock ?? '未设置' }}<template v-if="item.safetyStock !== null">
            {{ item.unit }}</template
          >
        </div>

        <div class="ih-inventory-row__actions">
          <el-button text :icon="Edit" @click="openEdit(item)" />
          <el-button text :icon="Delete" @click="remove(item)" />
        </div>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑库存物品' : '添加库存物品'"
      width="min(440px, 92vw)"
    >
      <el-form label-position="top">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：鸡蛋" maxlength="100" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="form.category" style="width: 100%">
            <el-option
              v-for="c in INGREDIENT_CATEGORIES"
              :key="c"
              :value="c"
              :label="INGREDIENT_CATEGORY_LABELS[c]"
            />
          </el-select>
        </el-form-item>
        <div class="ih-inventory-form__row">
          <el-form-item label="数量" required>
            <el-input-number v-model="form.quantity" :min="0" :step="1" style="width: 100%" />
          </el-form-item>
          <el-form-item label="单位" required>
            <el-input v-model="form.unit" placeholder="如：个 / g / 袋" maxlength="20" />
          </el-form-item>
        </div>
        <el-form-item label="安全库存（低于这个值会进采购清单，不填表示不提醒）">
          <el-input-number
            v-model="form.safetyStock"
            :min="0"
            :step="1"
            style="width: 100%"
            placeholder="不设阈值"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" placeholder="存放位置 / 保质期之类" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ih-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}

.ih-page-title {
  font-size: 28px;
  margin: 0 0 4px;
}

.ih-inventory-tabs {
  margin-bottom: 16px;
}

.ih-inventory-tabs__badge {
  margin-left: 6px;
}

.ih-inventory-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ih-skeleton {
  height: 64px;
  background: linear-gradient(100deg, #f3ede3 30%, #efe6d9 50%, #f3ede3 70%);
  background-size: 200% 100%;
  animation: ih-shimmer 1.4s ease-in-out infinite;
}

@keyframes ih-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.ih-inventory-row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px 18px;
  flex-wrap: wrap;
}

.ih-inventory-row--low {
  border-color: #e3a5a5;
  background: #fdf5f5;
}

.ih-inventory-row__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 180px;
  flex: 1;
}

.ih-inventory-row__name {
  font-weight: 600;
  font-size: 15px;
}

.ih-inventory-row__warn {
  background: #f6dede;
  color: #c45c5c;
}

.ih-inventory-row__quantity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ih-inventory-row__amount {
  min-width: 72px;
  text-align: center;
  font-weight: 600;
  color: var(--ih-primary-dark);
}

.ih-inventory-row__safety {
  font-size: 13px;
  min-width: 140px;
}

.ih-inventory-row__actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.ih-inventory-form__row {
  display: flex;
  gap: 16px;
}

.ih-inventory-form__row :deep(.el-form-item) {
  flex: 1;
}

.ih-empty {
  padding: 60px 0;
}
</style>
