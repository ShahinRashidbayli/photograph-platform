import React from 'react';
import { render, screen } from '@testing-library/react';
import { setupUser } from '@/test-utils/render';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  /**
   * The whole point of the component: these settings used to be the word
   * "Enabled" wired to an onClick, which assistive tech announces as a piece
   * of text, not a control with a state.
   */
  it('is a switch that reports its state', () => {
    render(<Toggle checked onChange={jest.fn()} label="Allow downloads" />);

    const control = screen.getByRole('switch', { name: 'Allow downloads' });
    expect(control).toHaveAttribute('aria-checked', 'true');
  });

  it('reports being off', () => {
    render(<Toggle checked={false} onChange={jest.fn()} label="Watermark" />);

    expect(screen.getByRole('switch', { name: 'Watermark' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('hands back the flipped value', async () => {
    const user = setupUser();
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} label="Watermark" />);

    await user.click(screen.getByRole('switch', { name: 'Watermark' }));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('turns off again', async () => {
    const user = setupUser();
    const onChange = jest.fn();
    render(<Toggle checked onChange={onChange} label="Watermark" />);

    await user.click(screen.getByRole('switch', { name: 'Watermark' }));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  /** `<button>` gets this for free — a clickable `<span>` would not. */
  it('is operable from the keyboard', async () => {
    const user = setupUser();
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} label="Watermark" />);

    await user.tab();
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('says nothing and does nothing while disabled', async () => {
    const user = setupUser();
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} label="Watermark" disabled />);

    await user.click(screen.getByRole('switch', { name: 'Watermark' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the description that explains what the state means', () => {
    render(
      <Toggle
        checked={false}
        onChange={jest.fn()}
        label="Watermark"
        description="Off — photos are shown without your logo"
      />
    );

    expect(screen.getByText('Off — photos are shown without your logo')).toBeInTheDocument();
  });
});
