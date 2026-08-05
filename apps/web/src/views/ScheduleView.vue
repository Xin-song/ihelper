<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft, ArrowRight, Delete, Plus } from '@element-plus/icons-vue';
import type { CalendarEventDto, TaskDto, TaskPriority, TaskStatus } from '@ihelper/shared';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  getUsFederalHolidays,
} from '@ihelper/shared';
import { tasksApi } from '../api/tasks';
import { calendarEventsApi } from '../api/calendar-events';
import TaskTopicBoard from '../components/task-board/TaskTopicBoard.vue';

const activeTab = ref<'calendar' | 'board' | 'tasks' | 'topics'>('calendar');

/* ---------- 日期工具：原生 Date，不引入新依赖 ---------- */
function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
/** 周一为一周的开始 */
function startOfWeek(d: Date) {
  const r = startOfDay(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(r, diff);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isToday(d: Date) {
  return dateKey(d) === dateKey(new Date());
}
function formatTimeRange(e: CalendarEventDto) {
  const fmt = (s: string) =>
    new Date(s).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(e.startAt)} - ${fmt(e.endAt)}`;
}

/** 美国联邦假日：覆盖当前日历视图、看板视图涉及到的所有年份，本地计算不发请求 */
const holidaysByDate = computed(() => {
  const years = new Set<number>();
  flatMonthDays.value.forEach((d) => years.add(d.getFullYear()));
  agendaDays.value.forEach((d) => years.add(d.getFullYear()));
  boardDays.value.forEach((d) => years.add(d.getFullYear()));
  const map = new Map<string, string>();
  for (const year of years) {
    for (const h of getUsFederalHolidays(year)) map.set(h.date, h.name);
  }
  return map;
});
function holidayNameForDay(day: Date) {
  return holidaysByDate.value.get(dateKey(day));
}

/* ---------- 日历 tab ---------- */
type ViewMode = 'month' | 'week' | 'day';
const viewMode = ref<ViewMode>('month');
const anchorDate = ref(new Date());
const calendarLoading = ref(true);
const rangeEvents = ref<CalendarEventDto[]>([]);
const rangeTasks = ref<TaskDto[]>([]);
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

const monthWeeks = computed(() => {
  const gridStart = startOfWeek(startOfMonth(anchorDate.value));
  const gridEnd = addDays(startOfWeek(endOfMonth(anchorDate.value)), 6);
  const days: Date[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
});
const flatMonthDays = computed(() => monthWeeks.value.flat());

const agendaDays = computed(() => {
  if (viewMode.value === 'day') return [anchorDate.value];
  const start = startOfWeek(anchorDate.value);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
});

const range = computed(() => {
  if (viewMode.value === 'month') {
    return { from: startOfWeek(startOfMonth(anchorDate.value)), to: addDays(startOfWeek(endOfMonth(anchorDate.value)), 6) };
  }
  if (viewMode.value === 'week') {
    const start = startOfWeek(anchorDate.value);
    return { from: start, to: endOfDay(addDays(start, 6)) };
  }
  return { from: startOfDay(anchorDate.value), to: endOfDay(anchorDate.value) };
});

const rangeLabel = computed(() => {
  if (viewMode.value === 'month') {
    return anchorDate.value.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  }
  if (viewMode.value === 'week') {
    const start = startOfWeek(anchorDate.value);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}`;
  }
  return anchorDate.value.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
});

function itemsForDay(day: Date) {
  const key = dateKey(day);
  const tasks = rangeTasks.value.filter((t) => t.dueAt && dateKey(new Date(t.dueAt)) === key);
  const events = rangeEvents.value.filter((e) => {
    const s = startOfDay(new Date(e.startAt)).getTime();
    const en = startOfDay(new Date(e.endAt)).getTime();
    const dd = startOfDay(day).getTime();
    return dd >= s && dd <= en;
  });
  return { tasks, events };
}

async function loadRange() {
  calendarLoading.value = true;
  const params = { from: range.value.from.toISOString(), to: range.value.to.toISOString() };
  try {
    const [events, tasks] = await Promise.all([
      calendarEventsApi.list(params),
      tasksApi.list(params),
    ]);
    rangeEvents.value = events;
    rangeTasks.value = tasks;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    calendarLoading.value = false;
  }
}

watch([viewMode, range], loadRange, { immediate: true });

function goToday() {
  anchorDate.value = new Date();
}
function goPrev() {
  if (viewMode.value === 'month') {
    anchorDate.value = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth() - 1, 1);
  } else if (viewMode.value === 'week') {
    anchorDate.value = addDays(anchorDate.value, -7);
  } else {
    anchorDate.value = addDays(anchorDate.value, -1);
  }
}
function goNext() {
  if (viewMode.value === 'month') {
    anchorDate.value = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth() + 1, 1);
  } else if (viewMode.value === 'week') {
    anchorDate.value = addDays(anchorDate.value, 7);
  } else {
    anchorDate.value = addDays(anchorDate.value, 1);
  }
}

const dayDetailVisible = ref(false);
const selectedDay = ref<Date | null>(null);
const selectedDayItems = computed(() =>
  selectedDay.value ? itemsForDay(selectedDay.value) : { tasks: [] as TaskDto[], events: [] as CalendarEventDto[] },
);
function openDayDetail(day: Date) {
  selectedDay.value = day;
  dayDetailVisible.value = true;
}

/* ---------- 看板 tab：进行中 + 未来三天，按优先级排序 ---------- */
/** 固定按「今天」而非日历的 anchorDate 计算，不受日历翻页影响 */
const boardDays = computed(() => {
  const today = startOfDay(new Date());
  return [0, 1, 2].map((n) => addDays(today, n));
});
const boardDayLabels = ['今天', '明天', '后天'];
const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
function byPriorityDesc(a: TaskDto, b: TaskDto) {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}
function tasksDueOn(day: Date) {
  const key = dateKey(day);
  return allTasks.value.filter((t) => t.dueAt && dateKey(new Date(t.dueAt)) === key).sort(byPriorityDesc);
}
const inProgressTasks = computed(() =>
  [...allTasks.value.filter((t) => t.status === 'in_progress')].sort(byPriorityDesc),
);

/* ---------- 待办 tab ---------- */
const taskFilter = ref<'all' | 'in_progress' | 'done' | 'overdue'>('all');
const allTasks = ref<TaskDto[]>([]);
const tasksLoading = ref(true);
const quickTitle = ref('');
const quickDue = ref<Date | null>(null);

async function loadAllTasks() {
  tasksLoading.value = true;
  try {
    allTasks.value = await tasksApi.list();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    tasksLoading.value = false;
  }
}

const overdueCount = computed(() => allTasks.value.filter((t) => t.isOverdue).length);

const filteredTasks = computed(() => {
  let list = allTasks.value;
  if (taskFilter.value === 'in_progress') list = list.filter((t) => t.status === 'in_progress');
  else if (taskFilter.value === 'done') list = list.filter((t) => t.status === 'done');
  else if (taskFilter.value === 'overdue') list = list.filter((t) => t.isOverdue);
  return [...list].sort((a, b) => {
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
});

async function quickAddTask() {
  if (!quickTitle.value.trim()) return;
  try {
    const created = await tasksApi.create({
      title: quickTitle.value.trim(),
      dueAt: quickDue.value ? quickDue.value.toISOString() : undefined,
    });
    allTasks.value = [created, ...allTasks.value];
    quickTitle.value = '';
    quickDue.value = null;
    loadRange();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

function handleStatusChange(task: TaskDto, value: string | number | boolean) {
  setTaskStatus(task, value as TaskStatus);
}

async function setTaskStatus(task: TaskDto, status: TaskStatus) {
  try {
    const updated = await tasksApi.update(task.id, { status });
    const idx = allTasks.value.findIndex((t) => t.id === task.id);
    if (idx !== -1) allTasks.value[idx] = updated;
    loadRange();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

async function deleteTask(task: TaskDto) {
  try {
    await ElMessageBox.confirm(`确定删除待办「${task.title}」吗？`, '删除待办', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await tasksApi.remove(task.id);
    allTasks.value = allTasks.value.filter((t) => t.id !== task.id);
    loadRange();
    ElMessage.success('已删除');
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

/* ---------- 新建/编辑弹窗（待办 + 日程事件共用一个弹窗，type 切换） ---------- */
const itemFormVisible = ref(false);
const itemSubmitting = ref(false);
const editingTask = ref<TaskDto | null>(null);
const editingEvent = ref<CalendarEventDto | null>(null);
const itemForm = reactive({
  type: 'task' as 'task' | 'event',
  title: '',
  description: '',
  dueAt: null as Date | null,
  priority: 'medium' as TaskPriority,
  status: 'todo' as TaskStatus,
  tags: [] as string[],
  startAt: null as Date | null,
  endAt: null as Date | null,
  allDay: false,
  location: '',
});

function resetItemForm(prefillDate?: Date | null) {
  itemForm.type = 'task';
  itemForm.title = '';
  itemForm.description = '';
  itemForm.dueAt = prefillDate ?? null;
  itemForm.priority = 'medium';
  itemForm.status = 'todo';
  itemForm.tags = [];
  itemForm.startAt = prefillDate ?? null;
  itemForm.endAt = prefillDate ?? null;
  itemForm.allDay = false;
  itemForm.location = '';
}

function openCreate(prefillDate?: Date | null) {
  editingTask.value = null;
  editingEvent.value = null;
  resetItemForm(prefillDate);
  itemFormVisible.value = true;
}

function openEditTask(task: TaskDto) {
  editingTask.value = task;
  editingEvent.value = null;
  itemForm.type = 'task';
  itemForm.title = task.title;
  itemForm.description = task.description ?? '';
  itemForm.dueAt = task.dueAt ? new Date(task.dueAt) : null;
  itemForm.priority = task.priority;
  itemForm.status = task.status;
  itemForm.tags = [...task.tags];
  itemFormVisible.value = true;
}

function openEditEvent(event: CalendarEventDto) {
  editingEvent.value = event;
  editingTask.value = null;
  itemForm.type = 'event';
  itemForm.title = event.title;
  itemForm.description = event.description ?? '';
  itemForm.location = event.location ?? '';
  itemForm.startAt = new Date(event.startAt);
  itemForm.endAt = new Date(event.endAt);
  itemForm.allDay = event.allDay;
  itemFormVisible.value = true;
}

async function submitItem() {
  if (!itemForm.title.trim()) {
    ElMessage.warning('标题不能为空');
    return;
  }
  itemSubmitting.value = true;
  try {
    if (itemForm.type === 'task') {
      const payload = {
        title: itemForm.title.trim(),
        description: itemForm.description.trim() || undefined,
        dueAt: itemForm.dueAt ? itemForm.dueAt.toISOString() : undefined,
        priority: itemForm.priority,
        status: itemForm.status,
        tags: itemForm.tags,
      };
      if (editingTask.value) await tasksApi.update(editingTask.value.id, payload);
      else await tasksApi.create(payload);
    } else {
      if (!itemForm.startAt || !itemForm.endAt) {
        ElMessage.warning('请选择开始和结束时间');
        itemSubmitting.value = false;
        return;
      }
      if (itemForm.endAt.getTime() < itemForm.startAt.getTime()) {
        ElMessage.warning('结束时间不能早于开始时间');
        itemSubmitting.value = false;
        return;
      }
      const payload = {
        title: itemForm.title.trim(),
        description: itemForm.description.trim() || undefined,
        location: itemForm.location.trim() || undefined,
        startAt: itemForm.startAt.toISOString(),
        endAt: itemForm.endAt.toISOString(),
        allDay: itemForm.allDay,
      };
      if (editingEvent.value) await calendarEventsApi.update(editingEvent.value.id, payload);
      else await calendarEventsApi.create(payload);
    }
    ElMessage.success('已保存');
    itemFormVisible.value = false;
    await Promise.all([loadRange(), loadAllTasks()]);
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    itemSubmitting.value = false;
  }
}

async function deleteEditingItem() {
  const isTask = !!editingTask.value;
  const target = editingTask.value ?? editingEvent.value;
  if (!target) return;
  try {
    await ElMessageBox.confirm(`确定删除「${target.title}」吗？`, '删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    if (isTask) await tasksApi.remove(target.id);
    else await calendarEventsApi.remove(target.id);
    itemFormVisible.value = false;
    await Promise.all([loadRange(), loadAllTasks()]);
    ElMessage.success('已删除');
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

onMounted(loadAllTasks);
</script>

<template>
  <div>
    <div class="ih-page-header">
      <div>
        <h1 class="ih-heading ih-page-title">日程</h1>
        <p class="ih-muted">日历、待办、DDL 放在一起管理</p>
      </div>
      <el-button type="primary" round :icon="Plus" @click="openCreate()">添加</el-button>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="日历" name="calendar">
        <div class="ih-schedule-toolbar">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button label="month">月</el-radio-button>
            <el-radio-button label="week">周</el-radio-button>
            <el-radio-button label="day">日</el-radio-button>
          </el-radio-group>
          <div class="ih-schedule-nav">
            <el-button circle size="small" :icon="ArrowLeft" @click="goPrev" />
            <el-button size="small" round @click="goToday">今天</el-button>
            <el-button circle size="small" :icon="ArrowRight" @click="goNext" />
            <span class="ih-schedule-label">{{ rangeLabel }}</span>
          </div>
        </div>

        <div v-if="viewMode === 'month'" class="ih-month-grid" :class="{ 'ih-month-grid--loading': calendarLoading }">
          <div v-for="w in weekdayLabels" :key="w" class="ih-month-grid__weekday">{{ w }}</div>
          <div
            v-for="day in flatMonthDays"
            :key="dateKey(day)"
            class="ih-month-cell"
            :class="{
              'ih-month-cell--outside': day.getMonth() !== anchorDate.getMonth(),
              'ih-month-cell--today': isToday(day),
            }"
            @click="openDayDetail(day)"
          >
            <span class="ih-month-cell__num">{{ day.getDate() }}</span>
            <span v-if="holidayNameForDay(day)" class="ih-holiday-label">{{ holidayNameForDay(day) }}</span>
            <div class="ih-month-cell__items">
              <span
                v-for="e in itemsForDay(day).events.slice(0, 3)"
                :key="'e' + e.id"
                class="ih-schedule-dot ih-schedule-dot--event"
                >{{ e.title }}</span
              >
              <span
                v-for="t in itemsForDay(day).tasks.slice(0, 3 - Math.min(3, itemsForDay(day).events.length))"
                :key="'t' + t.id"
                class="ih-schedule-dot ih-schedule-dot--task"
                :class="{ 'ih-schedule-dot--overdue': t.isOverdue }"
                >{{ t.title }}</span
              >
              <span
                v-if="itemsForDay(day).tasks.length + itemsForDay(day).events.length > 3"
                class="ih-muted ih-month-cell__more"
              >
                +{{ itemsForDay(day).tasks.length + itemsForDay(day).events.length - 3 }} 更多
              </span>
            </div>
          </div>
        </div>

        <div v-else class="ih-agenda">
          <div v-for="day in agendaDays" :key="dateKey(day)" class="ih-agenda__day">
            <div class="ih-agenda__day-header" :class="{ 'ih-agenda__day-header--today': isToday(day) }">
              {{ day.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }) }}
              <span v-if="holidayNameForDay(day)" class="ih-holiday-label ih-holiday-label--inline">{{
                holidayNameForDay(day)
              }}</span>
            </div>
            <el-empty
              v-if="itemsForDay(day).tasks.length + itemsForDay(day).events.length === 0"
              description="没有安排"
              :image-size="50"
            />
            <div v-else class="ih-agenda__list">
              <div
                v-for="e in itemsForDay(day).events"
                :key="'e' + e.id"
                class="ih-agenda__item ih-card"
                @click="openEditEvent(e)"
              >
                <span class="ih-chip">{{ e.allDay ? '全天' : formatTimeRange(e) }}</span>
                <span class="ih-agenda__item-title">{{ e.title }}</span>
              </div>
              <div
                v-for="t in itemsForDay(day).tasks"
                :key="'t' + t.id"
                class="ih-agenda__item ih-card"
                :class="{ 'ih-agenda__item--overdue': t.isOverdue }"
                @click="openEditTask(t)"
              >
                <span class="ih-chip ih-chip--muted">待办</span>
                <span class="ih-agenda__item-title">{{ t.title }}</span>
                <span class="ih-chip">{{ TASK_STATUS_LABELS[t.status] }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="看板" name="board">
        <p class="ih-muted ih-board-hint">按优先级排序：进行中的工作，加未来三天每天的待办</p>
        <div class="ih-board">
          <div class="ih-board__column">
            <div class="ih-board__column-header ih-board__column-header--active">进行中</div>
            <el-empty v-if="inProgressTasks.length === 0" description="没有进行中的待办" :image-size="44" />
            <div v-else class="ih-board__cards">
              <div
                v-for="t in inProgressTasks"
                :key="t.id"
                class="ih-board__card"
                :class="`ih-board__card--priority-${t.priority}`"
                @click="openEditTask(t)"
              >
                <span class="ih-chip" :class="`ih-chip--priority-${t.priority}`">{{ TASK_PRIORITY_LABELS[t.priority] }}</span>
                <span class="ih-board__card-title">{{ t.title }}</span>
                <span v-if="t.dueAt" class="ih-muted ih-board__card-due" :class="{ 'ih-task-row__due--overdue': t.isOverdue }">
                  DDL {{ new Date(t.dueAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) }}
                </span>
              </div>
            </div>
          </div>

          <div v-for="(day, i) in boardDays" :key="dateKey(day)" class="ih-board__column">
            <div class="ih-board__column-header">
              {{ boardDayLabels[i] }}
              <span class="ih-muted">{{ day.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) }}</span>
              <span v-if="holidayNameForDay(day)" class="ih-holiday-label ih-holiday-label--inline">{{
                holidayNameForDay(day)
              }}</span>
            </div>
            <el-empty v-if="tasksDueOn(day).length === 0" description="没有待办" :image-size="44" />
            <div v-else class="ih-board__cards">
              <div
                v-for="t in tasksDueOn(day)"
                :key="t.id"
                class="ih-board__card"
                :class="`ih-board__card--priority-${t.priority}`"
                @click="openEditTask(t)"
              >
                <span class="ih-chip" :class="`ih-chip--priority-${t.priority}`">{{ TASK_PRIORITY_LABELS[t.priority] }}</span>
                <span class="ih-board__card-title">{{ t.title }}</span>
                <span class="ih-chip ih-chip--muted">{{ TASK_STATUS_LABELS[t.status] }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="tasks">
        <template #label>
          待办
          <el-badge v-if="overdueCount" :value="overdueCount" class="ih-schedule-tabs__badge" />
        </template>

        <div class="ih-task-quickadd">
          <el-input
            v-model="quickTitle"
            placeholder="快速添加待办，回车即可"
            maxlength="200"
            @keyup.enter="quickAddTask"
          />
          <el-date-picker
            v-model="quickDue"
            type="datetime"
            placeholder="截止时间（可选）"
            style="width: 200px"
          />
          <el-button type="primary" round :icon="Plus" @click="quickAddTask">添加</el-button>
        </div>

        <el-radio-group v-model="taskFilter" class="ih-task-filter">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="in_progress">进行中</el-radio-button>
          <el-radio-button label="done">已完成</el-radio-button>
          <el-radio-button label="overdue">已逾期</el-radio-button>
        </el-radio-group>

        <div v-if="tasksLoading" class="ih-task-list">
          <div v-for="i in 4" :key="i" class="ih-skeleton ih-card"></div>
        </div>
        <el-empty v-else-if="filteredTasks.length === 0" description="没有待办事项" class="ih-empty" />
        <div v-else class="ih-task-list">
          <div
            v-for="task in filteredTasks"
            :key="task.id"
            class="ih-task-row ih-card"
            :class="{ 'ih-task-row--overdue': task.isOverdue, 'ih-task-row--done': task.status === 'done' }"
          >
            <el-select
              :model-value="task.status"
              size="small"
              class="ih-task-row__status"
              @change="handleStatusChange(task, $event)"
            >
              <el-option v-for="s in TASK_STATUSES" :key="s" :value="s" :label="TASK_STATUS_LABELS[s]" />
            </el-select>

            <div class="ih-task-row__main" @click="openEditTask(task)">
              <span class="ih-task-row__title">{{ task.title }}</span>
              <span class="ih-chip" :class="`ih-chip--priority-${task.priority}`">{{
                TASK_PRIORITY_LABELS[task.priority]
              }}</span>
              <span v-for="tag in task.tags" :key="tag" class="ih-chip ih-chip--muted">{{ tag }}</span>
            </div>

            <span v-if="task.dueAt" class="ih-task-row__due" :class="{ 'ih-task-row__due--overdue': task.isOverdue }">
              {{ new Date(task.dueAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
            </span>

            <el-button text :icon="Delete" @click="deleteTask(task)" />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="主题看板" name="topics">
        <TaskTopicBoard v-if="activeTab === 'topics'" />
      </el-tab-pane>
    </el-tabs>

    <!-- 新建/编辑：待办 或 日程事件 -->
    <el-dialog
      v-model="itemFormVisible"
      :title="editingTask || editingEvent ? '编辑' : '新建'"
      width="min(520px, 92vw)"
    >
      <el-radio-group v-if="!editingTask && !editingEvent" v-model="itemForm.type" class="ih-item-type-switch">
        <el-radio-button label="task">待办</el-radio-button>
        <el-radio-button label="event">日程事件</el-radio-button>
      </el-radio-group>

      <el-form label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="itemForm.title" maxlength="200" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="itemForm.description" type="textarea" :rows="2" maxlength="2000" />
        </el-form-item>

        <template v-if="itemForm.type === 'task'">
          <div class="ih-item-form__row">
            <el-form-item label="截止时间">
              <el-date-picker v-model="itemForm.dueAt" type="datetime" style="width: 100%" placeholder="不填表示无截止日期" />
            </el-form-item>
            <el-form-item label="优先级">
              <el-select v-model="itemForm.priority" style="width: 100%">
                <el-option v-for="p in TASK_PRIORITIES" :key="p" :value="p" :label="TASK_PRIORITY_LABELS[p]" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item v-if="editingTask" label="状态">
            <el-select v-model="itemForm.status" style="width: 100%">
              <el-option v-for="s in TASK_STATUSES" :key="s" :value="s" :label="TASK_STATUS_LABELS[s]" />
            </el-select>
          </el-form-item>
          <el-form-item label="标签">
            <el-select v-model="itemForm.tags" multiple filterable allow-create default-first-option style="width: 100%" />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="全天事件">
            <el-switch v-model="itemForm.allDay" />
          </el-form-item>
          <div class="ih-item-form__row">
            <el-form-item label="开始时间" required>
              <el-date-picker
                v-model="itemForm.startAt"
                :type="itemForm.allDay ? 'date' : 'datetime'"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="结束时间" required>
              <el-date-picker
                v-model="itemForm.endAt"
                :type="itemForm.allDay ? 'date' : 'datetime'"
                style="width: 100%"
              />
            </el-form-item>
          </div>
          <el-form-item label="地点">
            <el-input v-model="itemForm.location" maxlength="200" />
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <div class="ih-item-form__footer">
          <el-button v-if="editingTask || editingEvent" text type="danger" @click="deleteEditingItem">删除</el-button>
          <span class="ih-item-form__spacer" />
          <el-button round @click="itemFormVisible = false">取消</el-button>
          <el-button type="primary" round :loading="itemSubmitting" @click="submitItem">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 某天详情 -->
    <el-dialog
      v-model="dayDetailVisible"
      :title="selectedDay ? selectedDay.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }) : ''"
      width="min(480px, 92vw)"
    >
      <div v-if="selectedDay && holidayNameForDay(selectedDay)" class="ih-holiday-label ih-holiday-label--block">
        {{ holidayNameForDay(selectedDay) }}
      </div>
      <el-empty
        v-if="selectedDayItems.tasks.length + selectedDayItems.events.length === 0"
        description="这天没有安排"
        :image-size="60"
      />
      <div v-else class="ih-agenda__list">
        <div
          v-for="e in selectedDayItems.events"
          :key="'e' + e.id"
          class="ih-agenda__item ih-card"
          @click="
            dayDetailVisible = false;
            openEditEvent(e);
          "
        >
          <span class="ih-chip">{{ e.allDay ? '全天' : formatTimeRange(e) }}</span>
          <span class="ih-agenda__item-title">{{ e.title }}</span>
        </div>
        <div
          v-for="t in selectedDayItems.tasks"
          :key="'t' + t.id"
          class="ih-agenda__item ih-card"
          :class="{ 'ih-agenda__item--overdue': t.isOverdue }"
          @click="
            dayDetailVisible = false;
            openEditTask(t);
          "
        >
          <span class="ih-chip ih-chip--muted">待办</span>
          <span class="ih-agenda__item-title">{{ t.title }}</span>
          <span class="ih-chip">{{ TASK_STATUS_LABELS[t.status] }}</span>
        </div>
      </div>
      <template #footer>
        <el-button
          round
          :icon="Plus"
          @click="
            dayDetailVisible = false;
            openCreate(selectedDay);
          "
          >在这天添加</el-button
        >
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

.ih-schedule-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.ih-schedule-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ih-schedule-label {
  font-weight: 600;
  margin-left: 4px;
  white-space: nowrap;
}

.ih-schedule-tabs__badge {
  margin-left: 6px;
}

/* 月视图 */
.ih-month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  transition: opacity 0.15s ease;
}

.ih-month-grid--loading {
  opacity: 0.5;
}

.ih-month-grid__weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--ih-text-secondary);
  padding-bottom: 4px;
}

.ih-month-cell {
  min-height: 96px;
  background: var(--ih-surface);
  border: 1px solid var(--ih-border);
  border-radius: var(--ih-radius-sm);
  padding: 6px 6px 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: box-shadow 0.15s ease;
}

.ih-month-cell:hover {
  box-shadow: var(--ih-shadow);
}

.ih-month-cell--outside {
  background: #faf8f5;
  color: var(--ih-text-secondary);
}

.ih-month-cell--today .ih-month-cell__num {
  background: var(--ih-primary);
  color: #fff;
  border-radius: 999px;
}

.ih-month-cell__num {
  font-size: 13px;
  font-weight: 600;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ih-month-cell__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.ih-schedule-dot {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: var(--ih-primary-light);
  color: var(--ih-primary-dark);
}

.ih-schedule-dot--event {
  background: #dde7e0;
  color: var(--ih-accent);
}

.ih-schedule-dot--overdue {
  background: #f6dede;
  color: #c45c5c;
}

.ih-month-cell__more {
  font-size: 11px;
}

.ih-holiday-label {
  font-size: 10px;
  color: var(--ih-accent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ih-holiday-label--inline {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 500;
}

.ih-holiday-label--block {
  font-size: 13px;
  font-weight: 600;
  color: var(--ih-accent);
  margin-bottom: 10px;
}

/* 看板视图 */
.ih-board-hint {
  margin-bottom: 12px;
}

.ih-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  align-items: start;
}

.ih-board__column {
  background: #faf8f5;
  border: 1px solid var(--ih-border);
  border-radius: var(--ih-radius);
  padding: 12px;
  min-height: 120px;
}

.ih-board__column-header {
  font-weight: 700;
  margin-bottom: 10px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.ih-board__column-header--active {
  color: var(--ih-primary-dark);
}

.ih-board__cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ih-board__card {
  background: var(--ih-surface);
  border: 1px solid var(--ih-border);
  border-left: 4px solid var(--ih-border);
  border-radius: var(--ih-radius-sm);
  padding: 8px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: box-shadow 0.15s ease;
}

.ih-board__card:hover {
  box-shadow: var(--ih-shadow);
}

.ih-board__card--priority-high {
  border-left-color: #c45c5c;
}

.ih-board__card--priority-medium {
  border-left-color: var(--ih-primary);
}

.ih-board__card--priority-low {
  border-left-color: var(--ih-text-secondary);
}

.ih-board__card-title {
  font-weight: 600;
  font-size: 14px;
}

.ih-board__card-due {
  font-size: 12px;
}

@media (max-width: 900px) {
  .ih-board {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .ih-board {
    grid-template-columns: 1fr;
  }
}

/* 周/日 agenda 视图 */
.ih-agenda {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ih-agenda__day-header {
  font-weight: 700;
  margin-bottom: 8px;
}

.ih-agenda__day-header--today {
  color: var(--ih-primary-dark);
}

.ih-agenda__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ih-agenda__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
}

.ih-agenda__item--overdue {
  border-color: #e3a5a5;
  background: #fdf5f5;
}

.ih-agenda__item-title {
  font-weight: 500;
  flex: 1;
}

/* 待办 tab */
.ih-task-quickadd {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.ih-task-filter {
  margin-bottom: 14px;
}

.ih-task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ih-skeleton {
  height: 56px;
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

.ih-task-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  flex-wrap: wrap;
}

.ih-task-row--overdue {
  border-color: #e3a5a5;
  background: #fdf5f5;
}

.ih-task-row--done .ih-task-row__title {
  text-decoration: line-through;
  color: var(--ih-text-secondary);
}

.ih-task-row__status {
  width: 96px;
  flex-shrink: 0;
}

.ih-task-row__main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 160px;
  cursor: pointer;
}

.ih-task-row__title {
  font-weight: 600;
  font-size: 15px;
}

.ih-chip--priority-high {
  background: #f6dede;
  color: #c45c5c;
}

.ih-chip--priority-low {
  background: #f1ede6;
  color: var(--ih-text-secondary);
}

.ih-task-row__due {
  font-size: 13px;
  color: var(--ih-text-secondary);
  white-space: nowrap;
}

.ih-task-row__due--overdue {
  color: #c45c5c;
  font-weight: 600;
}

/* 弹窗 */
.ih-item-type-switch {
  margin-bottom: 18px;
}

.ih-item-form__row {
  display: flex;
  gap: 16px;
}

.ih-item-form__row :deep(.el-form-item) {
  flex: 1;
}

.ih-item-form__footer {
  display: flex;
  align-items: center;
  width: 100%;
}

.ih-item-form__spacer {
  flex: 1;
}

.ih-empty {
  padding: 60px 0;
}
</style>
