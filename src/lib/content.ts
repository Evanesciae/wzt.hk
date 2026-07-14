import categories from '../data/kb-categories.json';

export const kbCategories = categories;

export function categoryTitle(slug: string) {
  return categories.find((category) => category.slug === slug)?.title ?? slug;
}

export const travelStatus = {
  upcoming: '即将出发',
  planning: '计划中',
  archived: '已归档',
} as const;

export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('zh-CN', options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateRange(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = formatDate(start, { year: 'numeric', month: 'short', day: 'numeric' });
  const endText = formatDate(end, sameYear
    ? { month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
  return `${startText} — ${endText}`;
}
