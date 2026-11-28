import { contractSubline } from './contract-status';

const t = (key: string, params?: Record<string, string>) => `${key} ${JSON.stringify(params)}`;
const format = { monthDayYear: (d: unknown) => `on(${String(d)})` };
const base = { recipientName: 'Maria Kellner', signedAt: null };

describe('contractSubline', () => {
  it('says a draft is a draft, not that it was sent', () => {
    expect(contractSubline({ ...base, status: 'DRAFT' }, t, format)).toBe(
      'contracts.draftFor {"name":"Maria Kellner"}'
    );
  });

  it('says a withdrawn contract was withdrawn', () => {
    expect(contractSubline({ ...base, status: 'CANCELLED' }, t, format)).toBe(
      'contracts.withdrawnFor {"name":"Maria Kellner"}'
    );
  });

  it('says sent while awaiting signature, and when once signed', () => {
    expect(contractSubline({ ...base, status: 'SENT' }, t, format)).toBe(
      'contracts.sentTo {"name":"Maria Kellner"}'
    );
    expect(
      contractSubline({ ...base, status: 'SIGNED', signedAt: '2026-11-20T10:00:00Z' }, t, format)
    ).toBe('contracts.signedOn {"date":"on(2026-11-20T10:00:00Z)"}');
  });
});
