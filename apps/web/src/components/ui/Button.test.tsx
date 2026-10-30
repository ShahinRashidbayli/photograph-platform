import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  /**
   * The default that matters most. A bare <button> inside a <form> submits it,
   * which has silently submitted forms from Cancel buttons in this codebase
   * before — so the primitive defaults to type="button" and callers opt in.
   */
  it('does not submit its form unless asked to', async () => {
    const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Cancel</Button>
        <Button type="submit">Save</Button>
      </form>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls its handler when clicked', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Issue invoice</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled', async () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Pay
      </Button>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Pay' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  /**
   * Busy and disabled look alike but say different things: busy is "this is
   * happening", which assistive tech announces, and it must still block the
   * second click that would double-charge someone.
   */
  it('announces busy state and swaps the label', () => {
    render(
      <Button busy busyLabel="Issuing…">
        Issue invoice
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('Issuing…');
  });

  it('keeps the original label when busy without a busyLabel', () => {
    render(<Button busy>Save</Button>);

    expect(screen.getByRole('button')).toHaveTextContent('Save');
  });

  it('is reachable and operable by keyboard', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Confirm</Button>);

    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalled();
  });
});
