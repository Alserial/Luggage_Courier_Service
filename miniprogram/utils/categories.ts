import type { ItemCategory } from '../types/index';

export const allowedCategories: Array<{ value: ItemCategory; label: string }> = [
  { value: 'clothing', label: '普通服饰鞋帽' },
  { value: 'books', label: '书籍资料' },
  { value: 'stationery', label: '文具' },
  { value: 'small_gifts', label: '小礼品' },
  { value: 'phone_accessories', label: '无电池 3C 配件' },
  { value: 'daily_items', label: '普通小件日用品' },
];

export const prohibitedCategoryText = [
  '食品、药品、保健品、烟酒、电子烟',
  '液体、粉末、喷雾、动植物及制品',
  '现金、贵金属、奢侈品、高价值电子产品',
  '危险品、武器、仿冒盗版、商业批量货物',
];

export function getCategoryLabel(value: string): string {
  return allowedCategories.find((item) => item.value === value)?.label || value;
}
