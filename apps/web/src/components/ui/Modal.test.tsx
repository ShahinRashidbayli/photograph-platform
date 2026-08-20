import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, ModalHeader } from './Modal';

describe('Modal', () => {
  it('exposes itself as a named dialog', () => {
    render(
      <Modal label="Pay invoice 2026-0001" onClose={jest.fn()}>
        content
      </Modal>
    );

    const dialog = screen.getByRole('dialog', { name: 'Pay invoice 2026-0001' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on Escape', async () => {
    const onClose = jest.fn();
    render(
      <Modal label="Issue an invoice" onClose={onClose}>
        content
      </Modal>
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked', async () => {
    const onClose = jest.fn();
    render(
      <Modal label="Issue an invoice" onClose={onClose}>
        content
      </Modal>
    );

    await userEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * Clicking inside the panel must not dismiss it — the payment dialog holds a
   * card form, and losing it mid-entry loses the entry.
   */
  it('stays open when the panel itself is clicked', async () => {
    const onClose = jest.fn();
    render(
      <Modal label="Issue an invoice" onClose={onClose}>
        <button type="button">Inside</button>
      </Modal>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Inside' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * Without this, dismissing a dialog drops focus onto <body> and a keyboard
   * user has to tab from the top of the page back to where they were.
   */
  it('returns focus to whatever opened it', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open && (
            <Modal label="Dialog" onClose={() => setOpen(false)}>
              <button type="button" onClick={() => setOpen(false)}>
                Done
              </button>
            </Modal>
          )}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });

    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(opener).toHaveFocus();
  });

  it('submits through the form when given onSubmit', async () => {
    const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <Modal label="Issue an invoice" onClose={jest.fn()} onSubmit={onSubmit}>
        <button type="submit">Issue</button>
      </Modal>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Issue' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  describe('ModalHeader', () => {
    it('renders a labelled close control', async () => {
      const onClose = jest.fn();
      render(
        <Modal label="Dialog" onClose={jest.fn()}>
          <ModalHeader title="Issue an invoice" subtitle="For Maria Kellner" onClose={onClose} />
        </Modal>
      );

      expect(screen.getByText('For Maria Kellner')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
