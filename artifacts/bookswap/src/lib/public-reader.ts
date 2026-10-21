import type { ReaderSummary } from '@/features/discover/api';

const privateContactPattern = /(?:\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b)|(?:\+?\d[\d\s().-]{6,}\d)/;
const addressPattern = /\b(?:road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|estate|house|flat|apartment|apt\.?|plot|block|building|unit|floor|door|p\.?\s?o\.?\s?box)\b/i;

export function isPrivateContactText(value: string | null | undefined) {
  if (!value) return false;
  return privateContactPattern.test(value) || addressPattern.test(value);
}

export function publicReaderName(reader: Pick<ReaderSummary, 'display_name' | 'username'> | null | undefined) {
  const displayName = reader?.display_name?.trim() ?? '';
  const username = reader?.username?.trim() ?? '';
  if (displayName && !privateContactPattern.test(displayName)) return displayName;
  if (username && !privateContactPattern.test(username)) return username;
  return 'BookSwap reader';
}

export function approximateAreaLabel(value: string | null | undefined) {
  const area = value?.trim() ?? '';
  if (!area) return 'Area not provided';
  if (isPrivateContactText(area) || /\b\d{1,5}\b/.test(area)) return 'Area shared privately';
  return area;
}
