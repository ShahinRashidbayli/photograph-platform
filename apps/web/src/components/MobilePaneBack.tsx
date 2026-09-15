'use client';

import React from 'react';

/**
 * The "back to the list" control on a narrow screen's detail pane.
 *
 * <p>Extracted when the second and third master-detail screen needed it.
 * Bookings had it inline; copying twenty-five lines of chevron into Leads and
 * Clients would have made three copies of one affordance, which is how the back
 * arrow ends up pointing in different directions on different screens.
 *
 * <p>Takes its own style rather than owning one, because each list/detail
 * screen already has a `backButton` entry in its style module and those agree
 * with the surrounding page's spacing scale.
 */
export function MobilePaneBack({
  label,
  onClick,
  style,
}: {
  label: string;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button type="button" style={style} onClick={onClick}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}
