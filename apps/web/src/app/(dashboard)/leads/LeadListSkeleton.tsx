import type { Styles } from './leadTypes';

export function LeadListSkeleton({ s }: Readonly<{ s: Styles }>) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={s.skeletonItem}>
          <div style={{ ...s.skeletonBlock, width: 52, height: 52, borderRadius: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...s.skeletonBlock, height: 12, width: '60%' }} />
            <div style={{ ...s.skeletonBlock, height: 10, width: '45%' }} />
          </div>
        </div>
      ))}
    </>
  );
}
