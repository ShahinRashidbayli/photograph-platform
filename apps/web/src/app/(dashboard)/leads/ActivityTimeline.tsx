import { LeadActivity } from '@/types/api';
import { useTranslation } from '@/lib/i18n';
import type { ColorTokens } from './leadTypes';

/**
 * Activity timeline — renders the audit-log entries returned by
 * GET /api/leads/{id}/activity in reverse chronological order.
 *
 * <p>Each known action type gets a human-readable label and an inline icon.
 * Unknown actions fall back to the raw action string so a future
 * LEAD_REPLIED / LEAD_REJECTED renders something useful even before this
 * mapping is updated.
 */
export function ActivityTimeline({
  activity,
  loading,
  c,
}: Readonly<{
  activity: LeadActivity[];
  loading: boolean;
  c: ColorTokens;
}>) {
  const { t, format } = useTranslation();
  if (loading) {
    return (
      <div style={{ fontSize: '0.82rem', color: c.textMuted, marginTop: '8px' }}>
        {t('leadActivity.loading')}
      </div>
    );
  }
  if (activity.length === 0) {
    return (
      <div style={{ fontSize: '0.82rem', color: c.textMuted, marginTop: '8px' }}>
        {t('leadActivity.empty')}
      </div>
    );
  }

  const label = (action: string): { title: string; detail?: string } => {
    switch (action) {
      case 'LEAD_CREATED':
        return { title: t('leadActivity.created'), detail: t('leadActivity.createdDetail') };
      case 'LEAD_CONVERTED':
        return { title: t('leadActivity.converted'), detail: t('leadActivity.convertedDetail') };
      case 'LEAD_REJECTED':
        return { title: t('leadActivity.rejected') };
      default:
        return { title: action.replace(/_/g, ' ').toLowerCase() };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: '10px' }}>
      {activity.map((entry, idx) => {
        const meta = label(entry.action);
        const isLast = idx === activity.length - 1;
        return (
          <div
            key={entry.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr',
              gap: '12px',
              position: 'relative',
              paddingBottom: isLast ? 0 : '14px',
            }}
          >
            {/* Vertical connecting line, except after the last item. */}
            {!isLast && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '13px',
                  top: '26px',
                  bottom: '-2px',
                  width: '1px',
                  background: c.divider,
                }}
              />
            )}
            <span
              aria-hidden
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: c.surfaceAlt,
                border: `1px solid ${c.border}`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background:
                    entry.action === 'LEAD_CONVERTED'
                      ? c.success
                      : entry.action === 'LEAD_REJECTED'
                        ? c.danger
                        : c.primary,
                }}
              />
            </span>
            <div style={{ paddingTop: '2px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: c.text }}>
                {meta.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: c.textMuted, marginTop: '2px' }}>
                {format.dateTime(entry.createdAt)}
                {meta.detail ? ` · ${meta.detail}` : ''}
                {entry.oldValue && entry.newValue ? ` · ${entry.oldValue} → ${entry.newValue}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
