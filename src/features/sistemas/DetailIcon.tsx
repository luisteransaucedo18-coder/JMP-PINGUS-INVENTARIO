export type DetailIconName = 'status' | 'user' | 'calendar' | 'flag' | 'layers' | 'tag' | 'context' | 'fields' | 'subtask' | 'checklist' | 'comment' | 'sort' | 'sparkles' | 'plus' | 'send' | 'chevron';
const paths: Record<DetailIconName, string> = {
  status: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z',
  flag: 'M5 21V3m0 0c4-4 10 4 14 0v10c-4 4-10-4-14 0',
  layers: 'm12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5',
  tag: 'M3 3h8l10 10-8 8L3 11V3Zm4 4h.01',
  context: 'M5 4h14v16H5V4Zm4 4h6m-6 4h6m-6 4h4',
  fields: 'M4 4h16v16H4V4Zm0 5h16M9 9v11',
  subtask: 'M6 3v10a3 3 0 0 0 3 3h11m-4-4 4 4-4 4M3 3h6',
  checklist: 'm3 6 2 2 3-4m3 2h10M3 13l2 2 3-4m3 2h10M3 20l2 2 3-4m3 2h10',
  comment: 'M21 4H3v13h5l4 4v-4h9V4Zm-14 5h10m-10 4h6',
  sort: 'm7 3-4 4m4-4 4 4M7 3v18m10 0-4-4m4 4 4-4m-4 4V3',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm8-2v4m-2-2h4',
  plus: 'M12 4v16M4 12h16',
  send: 'M19 4v9a3 3 0 0 1-3 3H4m5-5-5 5 5 5',
  chevron: 'm7 10 5 5 5-5',
};
export default function DetailIcon({ name, size = 16 }: { name: DetailIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="sys-detail-icon"><path d={paths[name]} /></svg>;
}
