import React from 'react';
import { render, screen } from '@testing-library/react';
import { Trans } from './Trans';

describe('Trans', () => {
  it('substitutes nodes into the sentence', () => {
    render(
      <p>
        <Trans
          template="I accept the {agb} and the {privacy}."
          values={{
            agb: <a href="/agb">AGB</a>,
            privacy: <a href="/datenschutz">Datenschutzerklärung</a>,
          }}
        />
      </p>
    );

    expect(screen.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', '/agb');
    expect(screen.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute(
      'href',
      '/datenschutz'
    );
    expect(screen.getByText(/I accept the/)).toBeInTheDocument();
  });

  /**
   * Word order differs between languages, which is the whole reason the
   * sentence stays one key: the same values must work whatever order a
   * translator puts them in.
   */
  it('follows the order the translation uses, not the order of the values', () => {
    const { container } = render(
      <Trans
        template="{second} kommt nach {first}."
        values={{ first: <b>eins</b>, second: <i>zwei</i> }}
      />
    );

    expect(container.textContent).toBe('zwei kommt nach eins.');
  });

  it('leaves an unmatched placeholder visible instead of deleting words', () => {
    const { container } = render(<Trans template="Accept the {missing} please" values={{}} />);

    expect(container.textContent).toBe('Accept the {missing} please');
  });

  it('renders a template with no placeholders unchanged', () => {
    const { container } = render(<Trans template="Nothing to substitute." values={{}} />);

    expect(container.textContent).toBe('Nothing to substitute.');
  });
});
