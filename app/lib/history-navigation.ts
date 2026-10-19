import INDEX from '../data/history-index.json' with {type:'json'};
export const HISTORY_INDEX = INDEX;
export function historyId(value: string | null | undefined) {
  return INDEX.some(item => item.id === value) ? value! : null;
}
export function historyLink(id: string) {
  const valid = historyId(id);
  return valid ? `/?storia=${encodeURIComponent(valid)}` : '/';
}
