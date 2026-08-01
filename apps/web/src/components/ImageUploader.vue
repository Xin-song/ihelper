<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Close } from '@element-plus/icons-vue';
import { MAX_UPLOAD_FILES, MAX_UPLOAD_SIZE_BYTES } from '@ihelper/shared';
import { uploadsApi } from '../api/uploads';

/**
 * 通用图片上传：选文件 → 传到 /uploads/images → 把返回的 URL 交给父组件。
 * 封面（max=1）、作业成品图（max=9）、打印版都复用这一个。
 */
const props = withDefaults(
  defineProps<{
    /** 已有的图片 URL 列表 */
    modelValue: string[];
    max?: number;
    /** 缩略图边长 */
    size?: number;
    hint?: string;
  }>(),
  { max: MAX_UPLOAD_FILES, size: 104, hint: '' },
);

const emit = defineEmits<{ 'update:modelValue': [string[]] }>();

const input = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

const remaining = computed(() => props.max - props.modelValue.length);
const accept = 'image/jpeg,image/png,image/webp,image/gif';

function pick() {
  input.value?.click();
}

async function onChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const picked = Array.from(target.files ?? []);
  // 先清掉 input，否则连续选同一个文件不会触发 change
  target.value = '';
  if (picked.length === 0) return;

  if (picked.length > remaining.value) {
    ElMessage.warning(`最多还能再传 ${remaining.value} 张`);
    return;
  }
  const tooBig = picked.filter((f) => f.size > MAX_UPLOAD_SIZE_BYTES);
  if (tooBig.length > 0) {
    ElMessage.error(
      `单张不能超过 ${Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)}MB：${tooBig
        .map((f) => f.name)
        .join('、')}`,
    );
    return;
  }

  uploading.value = true;
  try {
    const uploaded = await uploadsApi.images(picked);
    emit('update:modelValue', [...props.modelValue, ...uploaded.map((u) => u.url)]);
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    uploading.value = false;
  }
}

/**
 * 只从列表里摘掉，不去删服务端文件。
 * 表单可能被取消，此时删了文件反而会把别处引用的图弄没；孤儿文件由后续的
 * 清理任务处理（打印版图有明确的删除接口，会连文件一起删）。
 */
function removeAt(index: number) {
  const next = [...props.modelValue];
  next.splice(index, 1);
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="ih-uploader">
    <div class="ih-uploader__grid">
      <div
        v-for="(url, index) in modelValue"
        :key="url"
        class="ih-uploader__item"
        :style="{ width: `${size}px`, height: `${size}px` }"
      >
        <img :src="url" alt="" />
        <button type="button" class="ih-uploader__remove" title="移除" @click="removeAt(index)">
          <el-icon><Close /></el-icon>
        </button>
      </div>

      <button
        v-if="remaining > 0"
        type="button"
        class="ih-uploader__add"
        :style="{ width: `${size}px`, height: `${size}px` }"
        :disabled="uploading"
        @click="pick"
      >
        <el-icon v-if="!uploading" class="ih-uploader__add-icon"><Plus /></el-icon>
        <span v-else class="ih-uploader__spinner" />
        <span class="ih-uploader__add-text">{{ uploading ? '上传中' : '添加图片' }}</span>
      </button>
    </div>

    <p v-if="hint" class="ih-muted ih-uploader__hint">{{ hint }}</p>

    <input
      ref="input"
      type="file"
      :accept="accept"
      :multiple="max > 1"
      hidden
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.ih-uploader__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ih-uploader__item {
  position: relative;
  border-radius: var(--ih-radius-sm);
  overflow: hidden;
  border: 1px solid var(--ih-border);
  background: var(--ih-primary-light);
  flex-shrink: 0;
}

.ih-uploader__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ih-uploader__remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(44, 35, 29, 0.62);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.ih-uploader__remove:hover {
  background: rgba(44, 35, 29, 0.85);
}

.ih-uploader__add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px dashed var(--ih-border);
  border-radius: var(--ih-radius-sm);
  background: var(--ih-surface);
  color: var(--ih-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.ih-uploader__add:hover:not(:disabled) {
  border-color: var(--ih-primary);
  color: var(--ih-primary);
}

.ih-uploader__add:disabled {
  cursor: default;
  opacity: 0.7;
}

.ih-uploader__add-icon {
  font-size: 20px;
}

.ih-uploader__add-text {
  font-size: 12px;
}

.ih-uploader__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--ih-border);
  border-top-color: var(--ih-primary);
  border-radius: 50%;
  animation: ih-spin 0.7s linear infinite;
}

@keyframes ih-spin {
  to {
    transform: rotate(360deg);
  }
}

.ih-uploader__hint {
  font-size: 12px;
  margin: 8px 0 0;
}
</style>
