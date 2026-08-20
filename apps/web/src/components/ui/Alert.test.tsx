import React from 'react';
import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';

describe('Alert', () => {
  /**
   * Tone drives more than colour. A failure interrupts (`alert`); a
   * confirmation waits its turn (`status`), so a "Saved" message cannot cut
   * across whatever the user is currently reading.
   */
  it('interrupts for a failure', () => {
    render(<Alert tone="danger">Could not save your business details.</Alert>);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save your business details.');
  });

  it.each(['warning', 'success', 'info'] as const)('announces %s politely', (tone) => {
    render(<Alert tone={tone}>Business details saved.</Alert>);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an optional title above the body', () => {
    render(
      <Alert tone="warning" title="Incomplete">
        You can’t issue invoices yet.
      </Alert>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Incomplete');
    expect(screen.getByRole('status')).toHaveTextContent('You can’t issue invoices yet.');
  });
});
