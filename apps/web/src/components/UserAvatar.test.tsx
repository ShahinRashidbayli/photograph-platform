import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UserAvatar } from './UserAvatar';

const base = { size: 32, background: '#EEE', color: '#333' };

describe('UserAvatar', () => {
  it('shows the photo when there is one', () => {
    render(<UserAvatar {...base} name="Anna Fischer" src="https://cdn.test/a.jpg" />);

    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
      'src',
      'https://cdn.test/a.jpg'
    );
  });

  it('falls back to initials when there is no photo', () => {
    render(<UserAvatar {...base} name="Anna Fischer" src={null} />);

    expect(screen.getByText('AF')).toBeInTheDocument();
    expect(screen.queryByRole('presentation', { hidden: true })).not.toBeInTheDocument();
  });

  /**
   * Avatar URLs are presigned and expire, so a stored row can hand us a dead
   * link. Initials beat a broken-image glyph.
   */
  it('falls back to initials when the photo fails to load', () => {
    render(<UserAvatar {...base} name="Anna Fischer" src="https://cdn.test/expired.jpg" />);

    fireEvent.error(screen.getByRole('presentation', { hidden: true }));

    expect(screen.getByText('AF')).toBeInTheDocument();
  });

  /**
   * The subtle one: without resetting on `src`, a single expired URL would pin
   * the fallback on for the rest of the session — including immediately after
   * a successful re-upload, which is exactly when the user is looking.
   */
  it('gives a newly uploaded photo a fresh attempt after an earlier failure', () => {
    const { rerender } = render(
      <UserAvatar {...base} name="Anna Fischer" src="https://cdn.test/expired.jpg" />
    );
    fireEvent.error(screen.getByRole('presentation', { hidden: true }));
    expect(screen.getByText('AF')).toBeInTheDocument();

    rerender(<UserAvatar {...base} name="Anna Fischer" src="https://cdn.test/fresh.jpg" />);

    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
      'src',
      'https://cdn.test/fresh.jpg'
    );
  });

  it('scales the initials with the circle', () => {
    const { container } = render(<UserAvatar {...base} size={96} name="Anna Fischer" />);

    expect(container.firstChild).toHaveStyle({ width: '96px', fontSize: '35px' });
  });
});
