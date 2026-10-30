import React from 'react';
import { render, screen } from '@testing-library/react';
import { Field, Input, Select } from './Field';

describe('Field', () => {
  /**
   * The whole reason this primitive exists. A label rendered next to an input
   * looks correct and is still unusable: without the association a screen
   * reader announces an unlabelled field.
   */
  it('associates its label with the control', () => {
    render(<Field label="Steuernummer">{(props) => <Input {...props} />}</Field>);

    expect(screen.getByLabelText('Steuernummer')).toBeInTheDocument();
  });

  it('reads its hint out as the field description', () => {
    render(
      <Field label="USt-IdNr." hint="One of the two is enough.">
        {(props) => <Input {...props} />}
      </Field>
    );

    expect(screen.getByLabelText('USt-IdNr.')).toHaveAccessibleDescription(
      'One of the two is enough.'
    );
  });

  /**
   * An error has to reach the user through the control, not just visually next
   * to it — otherwise the one thing standing between them and a valid form is
   * the one thing they cannot perceive.
   */
  it('marks the control invalid and describes it with the error', () => {
    render(
      <Field label="City" error="City is required">
        {(props) => <Input {...props} />}
      </Field>
    );

    const input = screen.getByLabelText('City');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('City is required');
    expect(screen.getByRole('alert')).toHaveTextContent('City is required');
  });

  it('shows the error instead of the hint when both are given', () => {
    render(
      <Field label="Country" hint="Two-letter code" error="Must be 2 letters">
        {(props) => <Input {...props} />}
      </Field>
    );

    expect(screen.queryByText('Two-letter code')).not.toBeInTheDocument();
    expect(screen.getByText('Must be 2 letters')).toBeInTheDocument();
  });

  it('works with a select as well as an input', () => {
    render(
      <Field label="Tax treatment">
        {(props) => (
          <Select {...props} defaultValue="KLEINUNTERNEHMER">
            <option value="KLEINUNTERNEHMER">Kleinunternehmer</option>
            <option value="REGELBESTEUERUNG">Regelbesteuerung</option>
          </Select>
        )}
      </Field>
    );

    expect(screen.getByLabelText('Tax treatment')).toHaveValue('KLEINUNTERNEHMER');
  });

  /** Two fields on one form must not collide on a hardcoded id. */
  it('gives each field its own id', () => {
    render(
      <>
        <Field label="First">{(props) => <Input {...props} />}</Field>
        <Field label="Second">{(props) => <Input {...props} />}</Field>
      </>
    );

    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });
});
