<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Close, Plus } from '@element-plus/icons-vue';
import type { TaskDto, TaskPriority } from '@ihelper/shared';
import { useTaskBoardContext } from './context';

const { tasks, updateTask } = useTaskBoardContext();

/* ---------- 常量与时间工具：原生实现，不引入拖拽/日期库 ---------- */
const PX_PER_MINUTE = 1;
const MINUTES_PER_DAY = 24 * 60;
const SNAP_MINUTES = 15;
const DEFAULT_DURATION_MINUTES = 30;
const MIN_DURATION_MINUTES = 15;
const TRACK_HEIGHT = MINUTES_PER_DAY * PX_PER_MINUTE;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}
function isToday(d: Date) {
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}
function snap(minutes: number) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function commitSchedule(id: string, startMinutes: number, endMinutes: number) {
  const base = startOfToday();
  const start = new Date(base);
  start.setMinutes(startMinutes);
  const end = new Date(base);
  end.setMinutes(endMinutes);
  updateTask(id, { scheduledStartAt: start.toISOString(), scheduledEndAt: end.toISOString() });
}
function unschedule(id: string) {
  updateTask(id, { scheduledStartAt: null, scheduledEndAt: null });
}

/* ---------- 数据切分：待办列表（未排入时间轴） / 今日时间轴上的任务 ---------- */
const backlogTasks = computed(() =>
  tasks.value.filter(
    (t) => !t.isArchived && t.status !== 'done' && t.status !== 'cancelled' && !t.scheduledStartAt,
  ),
);

const scheduledToday = computed(() =>
  tasks.value.filter(
    (t) => !t.isArchived && t.scheduledStartAt && isToday(new Date(t.scheduledStartAt)),
  ),
);

/* ---------- 渲染色块：拖拽/调整中的那一块用本地预览值覆盖，避免频繁打 API ---------- */
interface MovePreview {
  id: string;
  startMinutes: number;
  endMinutes: number;
}
const movePreview = ref<MovePreview | null>(null);

interface RenderedBlock {
  id: string;
  title: string;
  priority: TaskPriority;
  startMinutes: number;
  endMinutes: number;
  top: number;
  height: number;
}
const renderedBlocks = computed<RenderedBlock[]>(() =>
  scheduledToday.value.map((t) => {
    const override = movePreview.value?.id === t.id ? movePreview.value : null;
    const startMinutes = override ? override.startMinutes : minutesSinceMidnight(new Date(t.scheduledStartAt!));
    const endMinutes = override ? override.endMinutes : minutesSinceMidnight(new Date(t.scheduledEndAt!));
    return {
      id: t.id,
      title: t.title,
      priority: t.priority,
      startMinutes,
      endMinutes,
      top: startMinutes * PX_PER_MINUTE,
      height: Math.max((endMinutes - startMinutes) * PX_PER_MINUTE, MIN_DURATION_MINUTES * PX_PER_MINUTE),
    };
  }),
);

/* ---------- 时间轴 DOM 引用 ---------- */
const scrollRef = ref<HTMLElement | null>(null);
const trackRef = ref<HTMLElement | null>(null);
const hours = Array.from({ length: 24 }, (_, i) => i);

onMounted(() => {
  if (scrollRef.value) {
    const now = new Date();
    scrollRef.value.scrollTop = Math.max(0, now.getHours() - 1) * 60 * PX_PER_MINUTE;
  }
});

/* ---------- 拖拽 1：把待办列表的卡片拖到时间轴上，新建排入 ---------- */
const dragGhost = reactive({ visible: false, x: 0, y: 0, title: '' });
const newDragPreview = ref<{ top: number; height: number; startMinutes: number } | null>(null);

function trackMinutesFromClientY(clientY: number): number | null {
  if (!trackRef.value) return null;
  const rect = trackRef.value.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) return null;
  return clamp((clientY - rect.top) / PX_PER_MINUTE, 0, MINUTES_PER_DAY);
}

function onBacklogPointerDown(event: PointerEvent, task: TaskDto) {
  event.preventDefault();
  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;

  function onMove(ev: PointerEvent) {
    if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) dragging = true;
    if (!dragging) return;
    dragGhost.visible = true;
    dragGhost.x = ev.clientX;
    dragGhost.y = ev.clientY;
    dragGhost.title = task.title;
    const minutes = trackMinutesFromClientY(ev.clientY);
    if (minutes === null) {
      newDragPreview.value = null;
      return;
    }
    const snapped = clamp(snap(minutes), 0, MINUTES_PER_DAY - DEFAULT_DURATION_MINUTES);
    newDragPreview.value = {
      startMinutes: snapped,
      top: snapped * PX_PER_MINUTE,
      height: DEFAULT_DURATION_MINUTES * PX_PER_MINUTE,
    };
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (dragging && newDragPreview.value) {
      commitSchedule(
        task.id,
        newDragPreview.value.startMinutes,
        newDragPreview.value.startMinutes + DEFAULT_DURATION_MINUTES,
      );
    }
    dragGhost.visible = false;
    newDragPreview.value = null;
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/** 点击「+」直接加入今日：取「现在」和「已有色块的最晚结束时间」中较晚者，默认 30 分钟时长 */
function quickAddToToday(task: TaskDto) {
  const now = new Date();
  const nowMinutes = snap(minutesSinceMidnight(now));
  const latestEnd = renderedBlocks.value.reduce((max, b) => Math.max(max, b.endMinutes), 0);
  const start = clamp(Math.max(nowMinutes, latestEnd), 0, MINUTES_PER_DAY - DEFAULT_DURATION_MINUTES);
  commitSchedule(task.id, start, start + DEFAULT_DURATION_MINUTES);
}

/* ---------- 拖拽 2：整体挪动已排入时间轴的色块 ---------- */
function onBlockPointerDown(event: PointerEvent, block: RenderedBlock) {
  event.preventDefault();
  const startY = event.clientY;
  const initialStart = block.startMinutes;
  const duration = block.endMinutes - block.startMinutes;

  function onMove(ev: PointerEvent) {
    const delta = snap((ev.clientY - startY) / PX_PER_MINUTE);
    const newStart = clamp(initialStart + delta, 0, MINUTES_PER_DAY - duration);
    movePreview.value = { id: block.id, startMinutes: newStart, endMinutes: newStart + duration };
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (movePreview.value) commitSchedule(block.id, movePreview.value.startMinutes, movePreview.value.endMinutes);
    movePreview.value = null;
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/* ---------- 拖拽 3：拖色块上/下边框，只调整开始或结束时间 ---------- */
function onResizeStart(event: PointerEvent, block: RenderedBlock, edge: 'start' | 'end') {
  event.preventDefault();
  event.stopPropagation();
  const startY = event.clientY;
  const initialStart = block.startMinutes;
  const initialEnd = block.endMinutes;

  function onMove(ev: PointerEvent) {
    const delta = snap((ev.clientY - startY) / PX_PER_MINUTE);
    if (edge === 'start') {
      const newStart = clamp(initialStart + delta, 0, initialEnd - MIN_DURATION_MINUTES);
      movePreview.value = { id: block.id, startMinutes: newStart, endMinutes: initialEnd };
    } else {
      const newEnd = clamp(initialEnd + delta, initialStart + MIN_DURATION_MINUTES, MINUTES_PER_DAY);
      movePreview.value = { id: block.id, startMinutes: initialStart, endMinutes: newEnd };
    }
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (movePreview.value) commitSchedule(block.id, movePreview.value.startMinutes, movePreview.value.endMinutes);
    movePreview.value = null;
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
</script>

<template>
  <div class="ih-today-board">
    <div class="ih-today-board__backlog">
      <h3 class="ih-heading ih-today-board__backlog-title">待办事项</h3>
      <p class="ih-muted ih-today-board__hint">拖到右边时间轴上，或点「+」直接加入今日</p>
      <el-empty v-if="backlogTasks.length === 0" description="没有待安排的事项" :image-size="50" />
      <div
        v-for="t in backlogTasks"
        :key="t.id"
        class="ih-backlog-item ih-card"
        @pointerdown="onBacklogPointerDown($event, t)"
      >
        <span class="ih-backlog-item__title">{{ t.title }}</span>
        <el-button circle size="small" :icon="Plus" @click.stop="quickAddToToday(t)" />
      </div>
    </div>

    <div class="ih-today-board__timeline">
      <h3 class="ih-heading ih-today-board__backlog-title">今日时间规划</h3>
      <div ref="scrollRef" class="ih-timeline-scroll">
        <div ref="trackRef" class="ih-timeline-track" :style="{ height: TRACK_HEIGHT + 'px' }">
          <div v-for="h in hours" :key="h" class="ih-timeline-hour" :style="{ top: h * 60 * PX_PER_MINUTE + 'px' }">
            <span class="ih-timeline-hour__label">{{ String(h).padStart(2, '0') }}:00</span>
          </div>

          <div
            v-if="newDragPreview"
            class="ih-timeline-preview"
            :style="{ top: newDragPreview.top + 'px', height: newDragPreview.height + 'px' }"
          />

          <div
            v-for="block in renderedBlocks"
            :key="block.id"
            class="ih-timeline-block"
            :class="`ih-timeline-block--priority-${block.priority}`"
            :style="{ top: block.top + 'px', height: block.height + 'px' }"
            @pointerdown="onBlockPointerDown($event, block)"
          >
            <div class="ih-timeline-resize ih-timeline-resize--top" @pointerdown="onResizeStart($event, block, 'start')" />
            <div class="ih-timeline-block__body">
              <span class="ih-timeline-block__title">{{ block.title }}</span>
              <span class="ih-timeline-block__time">{{ formatMinutes(block.startMinutes) }} - {{ formatMinutes(block.endMinutes) }}</span>
              <el-button text size="small" :icon="Close" @click.stop="unschedule(block.id)" />
            </div>
            <div class="ih-timeline-resize ih-timeline-resize--bottom" @pointerdown="onResizeStart($event, block, 'end')" />
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="dragGhost.visible" class="ih-drag-ghost" :style="{ left: dragGhost.x + 12 + 'px', top: dragGhost.y + 12 + 'px' }">
        {{ dragGhost.title }}
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ih-today-board {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 800px) {
  .ih-today-board {
    grid-template-columns: 1fr;
  }
}

.ih-today-board__backlog-title {
  font-size: 16px;
  margin: 0 0 4px;
}

.ih-today-board__hint {
  margin: 0 0 12px;
  font-size: 12px;
}

.ih-backlog-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.ih-backlog-item__title {
  font-weight: 500;
  font-size: 14px;
}

.ih-timeline-scroll {
  height: 560px;
  overflow-y: auto;
  border: 1px solid var(--ih-border);
  border-radius: var(--ih-radius);
  background: var(--ih-surface);
}

.ih-timeline-track {
  position: relative;
  margin-left: 56px;
  border-left: 1px solid var(--ih-border);
}

.ih-timeline-hour {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid var(--ih-border);
}

.ih-timeline-hour__label {
  position: absolute;
  left: -56px;
  top: -8px;
  width: 48px;
  text-align: right;
  font-size: 11px;
  color: var(--ih-text-secondary);
}

.ih-timeline-preview {
  position: absolute;
  left: 4px;
  right: 4px;
  border-radius: var(--ih-radius-sm);
  background: rgba(226, 98, 44, 0.18);
  border: 1px dashed var(--ih-primary);
  pointer-events: none;
}

.ih-timeline-block {
  position: absolute;
  left: 4px;
  right: 4px;
  border-radius: var(--ih-radius-sm);
  background: var(--ih-primary-light);
  border-left: 4px solid var(--ih-primary);
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.ih-timeline-block--priority-high {
  border-left-color: #c45c5c;
}

.ih-timeline-block--priority-low {
  border-left-color: var(--ih-text-secondary);
}

.ih-timeline-block__body {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  font-size: 12px;
}

.ih-timeline-block__title {
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ih-timeline-block__time {
  color: var(--ih-primary-dark);
  white-space: nowrap;
}

.ih-timeline-resize {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  touch-action: none;
}

.ih-timeline-resize--top {
  top: 0;
}

.ih-timeline-resize--bottom {
  bottom: 0;
}

.ih-drag-ghost {
  position: fixed;
  z-index: 3000;
  pointer-events: none;
  background: var(--ih-primary);
  color: #fff;
  padding: 6px 12px;
  border-radius: var(--ih-radius-sm);
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--ih-shadow-hover);
}
</style>
