/**
 * 菜谱模块的应用层枚举常量。
 * 数据库里这些字段一律是 TEXT，不用 Postgres enum（改 enum 成本高），
 * 合法值校验放在这一层，前后端共用同一份定义。
 */

export const INGREDIENT_CATEGORIES = [
  'vegetable', // 蔬菜
  'meat_poultry', // 肉禽
  'seafood', // 水产
  'condiment', // 调味
  'staple', // 主食
  'dry_goods', // 干货
  'other', // 其他
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  vegetable: '蔬菜',
  meat_poultry: '肉禽',
  seafood: '水产',
  condiment: '调味',
  staple: '主食',
  dry_goods: '干货',
  other: '其他',
};

export const AMOUNT_TYPES = ['exact', 'vague'] as const;
export type AmountType = (typeof AMOUNT_TYPES)[number];

/** 模糊用量标签，缩放时原样保留、不参与计算 */
export const VAGUE_AMOUNT_LABELS = ['适量', '少许', '按口味'] as const;
export type VagueAmountLabel = (typeof VAGUE_AMOUNT_LABELS)[number];

export const SPACE_MEMBER_ROLES = ['owner', 'member', 'readonly'] as const;
export type SpaceMemberRole = (typeof SPACE_MEMBER_ROLES)[number];

/** private：只在「我的菜谱」；public：同时出现在菜谱广场 */
export const RECIPE_VISIBILITIES = ['private', 'public'] as const;
export type RecipeVisibility = (typeof RECIPE_VISIBILITIES)[number];

export const RECIPE_VISIBILITY_LABELS: Record<RecipeVisibility, string> = {
  private: '仅自己可见',
  public: '公开到广场',
};

/** 搜索结果排序方式，REQUIREMENTS.md 1.5 */
export const RECIPE_SORT_OPTIONS = ['recent', 'lastCooked', 'rating', 'duration'] as const;
export type RecipeSortOption = (typeof RECIPE_SORT_OPTIONS)[number];

export const RECIPE_SORT_OPTION_LABELS: Record<RecipeSortOption, string> = {
  recent: '最近添加',
  lastCooked: '最近制作',
  rating: '评分',
  duration: '总耗时',
};

/** 打印版菜谱图的版式 */
export const PRINT_ORIENTATIONS = ['landscape', 'portrait'] as const;
export type PrintOrientation = (typeof PRINT_ORIENTATIONS)[number];

export const PRINT_ORIENTATION_LABELS: Record<PrintOrientation, string> = {
  landscape: '横版',
  portrait: '竖版',
};

/** Phase 1 前恒为该值，见 ARCHITECTURE.md 第 4 节 */
export const DEFAULT_SPACE_ID = '00000000-0000-0000-0000-000000000001';

export interface RecipeStep {
  stepNumber: number;
  body: string;
  imageUrl?: string;
  timerSeconds?: number;
}

/** 前后端共用的 API 响应形状，避免两边各写一份类型漂移 */

/** 登录用户，个人信息与作者展示共用这一份形状 */
export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  createdAt: string;
}

export type RecipeAuthorDto = Pick<UserDto, 'id' | 'username' | 'displayName'>;

export interface IngredientDto {
  id: string;
  name: string;
  aliases: string[];
  category: IngredientCategory;
  defaultUnit: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredientDto {
  id: string;
  ingredientId: string;
  ingredient: Pick<IngredientDto, 'id' | 'name' | 'defaultUnit' | 'category'>;
  amountType: AmountType;
  quantity: number | null;
  unit: string | null;
  vagueLabel: VagueAmountLabel | null;
  note: string | null;
  isOptional: boolean;
  sortOrder: number;
}

export interface RecipeListItemDto {
  id: string;
  title: string;
  coverImageUrl: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  difficulty: number | null;
  servings: number;
  visibility: RecipeVisibility;
  createdAt: string;
  updatedAt: string;
  /** 个人评分、最近制作时间：排序（评分/最近制作）用，见 RECIPE_SORT_OPTIONS */
  personalRating: number | null;
  lastCookedAt: string | null;
  authorId: string | null;
  /** 登录接入前建的存量菜谱没有作者，前端按「未认领」处理 */
  author: RecipeAuthorDto | null;
  /** 这道菜收到的作业数，广场和列表页展示用 */
  submissionCount?: number;
}

/**
 * 菜谱搜索/筛选查询参数，REQUIREMENTS.md 1.5。
 * 关键词覆盖标题/简介/步骤；食材反查传 ingredientIds，语义是「配料表里的必选项
 * 全部在这个食材集合里」（可选配料不参与判断），见 RecipesService.filterByIngredients。
 */
export interface RecipeListQuery {
  keyword?: string;
  category?: string;
  tags?: string[];
  difficulty?: number;
  /** 总耗时（prepMinutes + cookMinutes）不超过这个分钟数 */
  maxTotalMinutes?: number;
  sortBy?: RecipeSortOption;
  ingredientIds?: string[];
}

export interface RecipePrintImageDto {
  id: string;
  url: string;
  orientation: PrintOrientation;
  sortOrder: number;
  createdAt: string;
}

export interface RecipeDetailDto extends RecipeListItemDto {
  steps: RecipeStep[];
  source: string | null;
  recipeIngredients: RecipeIngredientDto[];
  printImages: RecipePrintImageDto[];
}

/** 作业：跟着某个菜谱做出来的成品帖 */
export interface SubmissionDto {
  id: string;
  recipeId: string;
  /** 登录接入前留下的存量作业没有 userId，前端按「未认领」处理，不显示删除按钮之外的限制 */
  userId: string | null;
  authorName: string;
  images: string[];
  body: string;
  rating: number | null;
  likeCount: number;
  createdAt: string;
  /** 作业广场里要显示「做的是哪道菜」，按菜谱查时后端不带这个字段 */
  recipe?: Pick<RecipeListItemDto, 'id' | 'title' | 'coverImageUrl'>;
}

/** 写入用的请求体形状，前端表单据此构造，后端 DTO 校验规则与此一一对应 */

export interface CreateIngredientInput {
  name: string;
  category: IngredientCategory;
  defaultUnit: string;
  aliases?: string[];
  note?: string;
}

export interface RecipeStepInput {
  body: string;
  imageUrl?: string;
  timerSeconds?: number;
}

export interface RecipeIngredientInput {
  ingredientId: string;
  amountType: AmountType;
  quantity?: number;
  unit?: string;
  vagueLabel?: VagueAmountLabel;
  note?: string;
  isOptional?: boolean;
}

export interface CreateRecipeInput {
  title: string;
  coverImageUrl?: string;
  description?: string;
  category?: string;
  tags?: string[];
  steps: RecipeStepInput[];
  prepMinutes?: number;
  cookMinutes?: number;
  difficulty?: number;
  servings: number;
  source?: string;
  visibility?: RecipeVisibility;
  ingredients: RecipeIngredientInput[];
}

export interface CreateSubmissionInput {
  /** 至少一张成品图，DB 侧也有 CHECK 兜底 */
  images: string[];
  body: string;
  rating?: number;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateProfileInput {
  displayName: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface CreatePrintImageInput {
  url: string;
  orientation: PrintOrientation;
}

/** 库存物品，REQUIREMENTS.md 2.1（提前做的最小版） */
export interface StockItemDto {
  id: string;
  name: string;
  category: IngredientCategory;
  quantity: number;
  unit: string;
  safetyStock: number | null;
  note: string | null;
  /** 派生字段：quantity < safetyStock，采购清单按这个过滤 */
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockItemInput {
  name: string;
  category: IngredientCategory;
  quantity: number;
  unit: string;
  safetyStock?: number;
  note?: string;
}

export type UpdateStockItemInput = Partial<CreateStockItemInput>;

/** 上传接口的返回形状 */
export interface UploadedImageDto {
  url: string;
  key: string;
}

/** 单张图片上限 10MB —— 手机直出的照片通常在 3-8MB */
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
/** 一次最多传 9 张，对齐九宫格 */
export const MAX_UPLOAD_FILES = 9;
