import { invoiceStatus } from './invoice-status';

const live = { live: true, stornoOfId: null, overdue: false, collectable: false };

describe('invoiceStatus', () => {
  it('reads the Settlement flags in order: not live, overdue, collectable', () => {
    expect(invoiceStatus({ ...live, live: false, stornoOfId: 'i0' })).toBe('storno');
    expect(invoiceStatus({ ...live, live: false })).toBe('cancelled');
    expect(invoiceStatus({ ...live, overdue: true, collectable: true })).toBe('overdue');
    expect(invoiceStatus({ ...live, collectable: true })).toBe('open');
    expect(invoiceStatus(live)).toBe('paid');
  });
});
