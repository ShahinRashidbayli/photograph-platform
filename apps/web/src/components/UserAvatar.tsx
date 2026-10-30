'use client';

import React, { useEffect, useState } from 'react';
import { getInitials } from '@/lib/avatar';

interface UserAvatarProps {
  /** Shown as initials when there is no usable photo. */
  name: string;
  /** Presigned photo URL, or null/undefined when none is set. */
  src?: string | null;
  /** Rendered width and height in pixels. */
  size: number;
  /** Circle background when falling back to initials. */
  background: string;
  /** Initials colour. */
  color: string;
  style?: React.CSSProperties;
}

/**
 * The signed-in person's profile photo, with their initials as the fallback.
 *
 * The photo was only ever rendered on the settings page, so someone who
 * uploaded one saw it once, on the screen where they set it, and then went on
 * seeing initials everywhere they actually work. One component now, used by
 * the sidebar, the header and settings alike, so the next place that needs an
 * avatar cannot quietly go back to initials-only.
 *
 * Two things this has to survive:
 *
 * A plain `<img>`, not `next/image`: `images.remotePatterns` in next.config is
 * empty, so next/image rejects every remote host outright — it threw "hostname
 * is not configured" the first time a user actually had an avatar.
 *
 * Avatar URLs are presigned and expire. A row can still hold a stale one, and
 * a request can simply fail, so a failed load falls back to initials rather
 * than leaving a broken-image glyph. `src` is tracked in state so a *new* URL
 * gets a fresh attempt — otherwise one expired link would pin the fallback on
 * for the rest of the session, including straight after a successful upload.
 */
export function UserAvatar({
  name,
  src,
  size,
  background,
  color,
  style,
}: Readonly<UserAvatarProps>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  const showPhoto = Boolean(src) && failedSrc !== src;

  const shared: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style,
  };

  if (showPhoto && src) {
    return (
      <span style={shared}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setFailedSrc(src)}
        />
      </span>
    );
  }

  return (
    <span
      style={{
        ...shared,
        background,
        color,
        fontWeight: 700,
        // Initials should scale with the circle rather than being restated at
        // every call site.
        fontSize: Math.max(10, Math.round(size * 0.36)),
        lineHeight: 1,
      }}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  );
}
