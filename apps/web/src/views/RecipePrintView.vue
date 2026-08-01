<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Delete, Download, Picture } from '@element-plus/icons-vue';
import type { PrintOrientation, RecipeDetailDto } from '@ihelper/shared';
import { PRINT_ORIENTATION_LABELS, PRINT_ORIENTATIONS } from '@ihelper/shared';
import { recipesApi } from '../api/recipes';
import { uploadsApi } from '../api/uploads';
import { downloadBlob, renderRecipePoster } from '../utils/recipe-poster';
import ImageUploader from '../components/ImageUploader.vue';

const route = useRoute();
const router = useRouter();

const recipe = ref<RecipeDetailDto | null>(null);
const loading = ref(true);

/** 上传区：选好版式再传，传完立刻挂到菜谱上 */
const uploadOrientation = ref<PrintOrientation>('portrait');
const pending = ref<string[]>([]);

/** 生成区 */
const generateOrientation = ref<PrintOrientation>('portrait');
const generating = ref(false);
const previewUrl = ref<string | null>(null);
const previewBlob = ref<Blob | null>(null);

const recipeId = computed(() => route.params.id as string);

async function load() {
  loading.value = true;
  try {
    recipe.value = await recipesApi.get(recipeId.value);
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

/**
 * ImageUploader 只负责把文件传成 URL，落到 pending 里；
 * 这里再把 URL 挂到菜谱上并清空 pending，避免用户传完忘了保存。
 */
async function onUploaded(urls: string[]) {
  const added = urls.filter((u) => !pending.value.includes(u));
  pending.value = urls;
  if (added.length === 0) return;

  try {
    for (const url of added) {
      await recipesApi.addPrintImage(recipeId.value, {
        url,
        orientation: uploadOrientation.value,
      });
    }
    pending.value = [];
    await load();
    ElMessage.success(`已添加 ${added.length} 张${PRINT_ORIENTATION_LABELS[uploadOrientation.value]}`);
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

async function removePrintImage(imageId: string) {
  try {
    await recipesApi.removePrintImage(recipeId.value, imageId);
    await load();
    ElMessage.success('已删除');
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

async function generate() {
  if (!recipe.value) return;
  generating.value = true;
  try {
    const blob = await renderRecipePoster(recipe.value, {
      orientation: generateOrientation.value,
    });
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewBlob.value = blob;
    previewUrl.value = URL.createObjectURL(blob);
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    generating.value = false;
  }
}

function download() {
  if (!previewBlob.value || !recipe.value) return;
  const suffix = PRINT_ORIENTATION_LABELS[generateOrientation.value];
  downloadBlob(previewBlob.value, `${recipe.value.title}-${suffix}.png`);
}

/** 把刚生成的图存成这道菜的打印版，跟手动上传的放在一起 */
async function saveGenerated() {
  if (!previewBlob.value || !recipe.value) return;
  try {
    const file = new File([previewBlob.value], `${recipe.value.title}.png`, {
      type: 'image/png',
    });
    const [uploaded] = await uploadsApi.images([file]);
    await recipesApi.addPrintImage(recipeId.value, {
      url: uploaded.url,
      orientation: generateOrientation.value,
    });
    await load();
    ElMessage.success('已存为打印版');
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
</script>

<template>
  <div v-if="loading" class="ih-print-loading">
    <el-skeleton :rows="6" animated />
  </div>

  <div v-else-if="recipe" class="ih-print">
    <div class="ih-print__header">
      <el-button :icon="ArrowLeft" text @click="router.push(`/recipes/${recipe.id}`)">
        返回菜谱
      </el-button>
      <h1 class="ih-heading ih-print__title">打印版 · {{ recipe.title }}</h1>
      <p class="ih-muted">生成一张排好版的菜谱图，或上传你自己做好的打印版</p>
    </div>

    <section class="ih-panel ih-card">
      <h2 class="ih-heading">生成打印图</h2>
      <p class="ih-muted ih-panel__desc">
        用这道菜的标题、配料和步骤直接排版成一张 A4 图片。内容多的时候会自动缩小字号排下，不会截断。
      </p>

      <div class="ih-print__controls">
        <el-radio-group v-model="generateOrientation">
          <el-radio-button v-for="o in PRINT_ORIENTATIONS" :key="o" :value="o">
            {{ PRINT_ORIENTATION_LABELS[o] }}
          </el-radio-button>
        </el-radio-group>
        <el-button type="primary" round :icon="Picture" :loading="generating" @click="generate">
          生成
        </el-button>
        <el-button v-if="previewBlob" round :icon="Download" @click="download">下载 PNG</el-button>
        <el-button v-if="previewBlob" round @click="saveGenerated">存为打印版</el-button>
      </div>

      <div v-if="previewUrl" class="ih-print__preview">
        <img :src="previewUrl" alt="生成的菜谱图预览" />
      </div>
    </section>

    <section class="ih-panel ih-card">
      <h2 class="ih-heading">上传打印版</h2>
      <p class="ih-muted ih-panel__desc">
        已经有排好的菜谱图（比如从别处导出的），可以直接传上来存在这道菜下面。
      </p>

      <div class="ih-print__controls">
        <span class="ih-muted">版式</span>
        <el-radio-group v-model="uploadOrientation">
          <el-radio-button v-for="o in PRINT_ORIENTATIONS" :key="o" :value="o">
            {{ PRINT_ORIENTATION_LABELS[o] }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <ImageUploader
        :model-value="pending"
        :size="120"
        hint="选好版式再上传，传完会自动挂到这道菜下面"
        @update:model-value="onUploaded"
      />
    </section>

    <section class="ih-panel ih-card">
      <h2 class="ih-heading">已有的打印版（{{ recipe.printImages.length }}）</h2>

      <el-empty
        v-if="recipe.printImages.length === 0"
        description="还没有打印版图片"
        :image-size="80"
      />

      <div v-else class="ih-print__gallery">
        <figure
          v-for="image in recipe.printImages"
          :key="image.id"
          class="ih-print__gallery-item"
          :class="`ih-print__gallery-item--${image.orientation}`"
        >
          <a :href="image.url" target="_blank" rel="noopener">
            <img :src="image.url" :alt="PRINT_ORIENTATION_LABELS[image.orientation]" />
          </a>
          <figcaption>
            <span class="ih-chip ih-chip--muted">
              {{ PRINT_ORIENTATION_LABELS[image.orientation] }}
            </span>
            <el-popconfirm
              title="删除这张打印版？文件也会一起删掉"
              confirm-button-text="删除"
              cancel-button-text="取消"
              @confirm="removePrintImage(image.id)"
            >
              <template #reference>
                <el-button :icon="Delete" text size="small" type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </figcaption>
        </figure>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ih-print {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ih-print__header {
  margin-bottom: 4px;
}

.ih-print__title {
  font-size: 28px;
  margin: 10px 0 4px;
}

.ih-panel {
  padding: 20px 22px;
}

.ih-panel h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.ih-panel__desc {
  font-size: 13px;
  margin: 0 0 16px;
  line-height: 1.6;
}

.ih-print__controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.ih-print__preview {
  border: 1px solid var(--ih-border);
  border-radius: var(--ih-radius-sm);
  overflow: hidden;
  background: var(--ih-bg);
  padding: 12px;
  display: flex;
  justify-content: center;
}

.ih-print__preview img {
  max-width: 100%;
  max-height: 620px;
  object-fit: contain;
  box-shadow: var(--ih-shadow);
}

.ih-print__gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.ih-print__gallery-item {
  margin: 0;
  border: 1px solid var(--ih-border);
  border-radius: var(--ih-radius-sm);
  overflow: hidden;
  background: var(--ih-bg);
  display: flex;
  flex-direction: column;
}

.ih-print__gallery-item--portrait {
  width: 180px;
}

.ih-print__gallery-item--landscape {
  width: 250px;
}

.ih-print__gallery-item img {
  width: 100%;
  display: block;
  object-fit: contain;
  background: #fff;
}

.ih-print__gallery-item figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: var(--ih-surface);
  border-top: 1px solid var(--ih-border);
}

.ih-print-loading {
  padding: 40px 0;
}
</style>
