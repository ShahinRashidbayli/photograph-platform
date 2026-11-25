'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { CONTRACTS, INVOICES, LEADS, PAYMENTS, PAYMENTS_RECEIVED_CENTS } from './mock';
import { Chip } from './parts';

type TabId = 'leads' | 'contracts' | 'payments' | 'invoices';

const TABS: { id: TabId; titleKey: TranslationKey; textKey: TranslationKey }[] = [
  { id: 'leads', titleKey: 'landing.product.leadsTitle', textKey: 'landing.product.leadsText' },
  {
    id: 'contracts',
    titleKey: 'landing.product.contractsTitle',
    textKey: 'landing.product.contractsText',
  },
  {
    id: 'payments',
    titleKey: 'landing.product.paymentsTitle',
    textKey: 'landing.product.paymentsText',
  },
  {
    id: 'invoices',
    titleKey: 'landing.product.invoicesTitle',
    textKey: 'landing.product.invoicesText',
  },
];

/** Score pills shade by band, so the list reads hottest-first at a glance. */
const scoreTone = (score: number) => (score >= 80 ? 'solid' : score >= 50 ? 'blue' : 'grey');

/**
 * Four features, each with the screen it lives on. A vertical tablist (WAI-ARIA
 * pattern): arrows move between tabs, Home/End jump, and only the selected tab
 * is in the Tab order. The previous static list looked selectable and was not.
 */
export function ProductTabs() {
  const { t, format } = useTranslation();
  const [active, setActive] = useState<TabId>('leads');
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    leads: null,
    contracts: null,
    payments: null,
    invoices: null,
  });

  const focusTab = (index: number) => {
    const tab = TABS[(index + TABS.length) % TABS.length];
    setActive(tab.id);
    tabRefs.current[tab.id]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((tab) => tab.id === active);
    const moves: Record<string, number> = {
      ArrowDown: current + 1,
      ArrowRight: current + 1,
      ArrowUp: current - 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: TABS.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    focusTab(moves[e.key]);
  };

  const activeTab = TABS.find((tab) => tab.id === active) ?? TABS[0];

  const budget = (b: (typeof LEADS)[number]['budget']) =>
    b.fromCents
      ? `${format.eur(b.fromCents)}–${format.eur(b.toCents)}`
      : t('landing.product.budgetUpTo', { amount: format.eur(b.toCents) });

  return (
    <section
      id="product"
      className="lp-section"
      data-tone="theme"
      aria-labelledby="lp-product-title"
    >
      <div className="lp-wrap">
        <div style={{ maxWidth: 720 }}>
          <h2 id="lp-product-title" className="lp-h2">
            {t('landing.product.title')}
          </h2>
          <p className="lp-lede">{t('landing.product.lede')}</p>
        </div>

        <div className="lp-tabs-layout">
          <div
            className="lp-tablist"
            role="tablist"
            aria-orientation="vertical"
            aria-label={t('landing.product.tabsAria')}
            onKeyDown={onKeyDown}
          >
            {TABS.map((tab) => {
              const selected = tab.id === active;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`lp-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`lp-panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  className="lp-tab"
                  onClick={() => setActive(tab.id)}
                >
                  <span className="lp-tab-title">
                    <span className="lp-tab-dot" aria-hidden="true" />
                    {t(tab.titleKey)}
                  </span>
                  <span className="lp-tab-text">{t(tab.textKey)}</span>
                </button>
              );
            })}
          </div>

          {/* Phones only: the tabs become one row of titles, and the selected
              feature's sentence sits here, right above its screen — stacked,
              a tap changed a panel four tabs further down, out of view. */}
          <p className="lp-tab-lede">{t(activeTab.textKey)}</p>

          <div className="lp-panel-frame">
            <div
              className="lp-panel lp-ui"
              role="tabpanel"
              id={`lp-panel-${active}`}
              aria-labelledby={`lp-tab-${active}`}
            >
              {active === 'leads' && (
                <>
                  <div className="lp-panel-head">
                    <div className="lp-ui-title">{t('landing.mock.nav.leads')}</div>
                    <div className="lp-panel-filters">
                      <span>{t('landing.product.filterActive', { count: '4' })}</span>
                      <span>{t('landing.product.filterBooked', { count: '9' })}</span>
                      <span>{t('landing.product.filterAll', { count: '21' })}</span>
                    </div>
                  </div>
                  <table className="lp-table">
                    <thead>
                      <tr>
                        <th scope="col">{t('landing.product.colName')}</th>
                        <th scope="col">{t('landing.product.colOccasion')}</th>
                        <th scope="col" className="lp-hide-sm">
                          {t('landing.product.colDate')}
                        </th>
                        <th scope="col" className="lp-hide-sm">
                          {t('landing.product.colBudget')}
                        </th>
                        <th scope="col" className="lp-end">
                          {t('landing.product.colScore')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {LEADS.map((lead) => (
                        <tr key={lead.name}>
                          <td className="lp-strong">{lead.name}</td>
                          <td>{t(lead.typeKey)}</td>
                          <td className="lp-hide-sm">
                            {lead.date
                              ? format.monthDayYear(lead.date)
                              : t('landing.product.dateOpen')}
                          </td>
                          <td className="lp-hide-sm">{budget(lead.budget)}</td>
                          <td className="lp-end">
                            <Chip tone={scoreTone(lead.score)}>{lead.score}</Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="lp-panel-actions" aria-hidden="true">
                    <span>{t('landing.product.convert')}</span>
                    <span>{t('landing.product.reply')}</span>
                  </div>
                </>
              )}

              {active === 'contracts' && (
                <>
                  <div className="lp-panel-head">
                    <div className="lp-ui-title">{t('landing.mock.nav.contracts')}</div>
                    <div className="lp-panel-filters">
                      <span>{t('landing.product.filterOpen', { count: '2' })}</span>
                      <span>{t('landing.product.filterSigned', { count: '14' })}</span>
                    </div>
                  </div>
                  <table className="lp-table">
                    <thead>
                      <tr>
                        <th scope="col">{t('landing.product.colClient')}</th>
                        <th scope="col">{t('landing.product.colContract')}</th>
                        <th scope="col" className="lp-hide-sm">
                          {t('landing.product.colDate')}
                        </th>
                        <th scope="col" className="lp-end">
                          {t('landing.product.colStatus')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {CONTRACTS.map((c) => (
                        <tr key={c.name}>
                          <td className="lp-strong">{c.name}</td>
                          <td>{t(c.contractKey)}</td>
                          <td className="lp-hide-sm">
                            {c.date ? format.monthDayYear(c.date) : '—'}
                          </td>
                          <td className="lp-end">
                            <Chip tone={c.tone}>{t(c.statusKey)}</Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="lp-panel-actions" aria-hidden="true">
                    <span>{t('landing.product.sendForSignature')}</span>
                    <span>{t('landing.product.pdf')}</span>
                  </div>
                </>
              )}

              {active === 'payments' && (
                <>
                  <div className="lp-panel-head">
                    <div className="lp-ui-title">{t('landing.product.paymentsTitle')}</div>
                    <div className="lp-ui-muted lp-num">
                      {t('landing.product.paymentsSummary', {
                        amount: format.eur(PAYMENTS_RECEIVED_CENTS),
                      })}
                    </div>
                  </div>
                  <table className="lp-table">
                    <thead>
                      <tr>
                        <th scope="col">{t('landing.product.colClient')}</th>
                        <th scope="col" className="lp-hide-sm">
                          {t('landing.product.colType')}
                        </th>
                        <th scope="col" className="lp-end">
                          {t('landing.product.colAmount')}
                        </th>
                        <th scope="col" className="lp-end">
                          {t('landing.product.colStatus')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {PAYMENTS.map((p) => (
                        <tr key={`${p.name}-${p.typeKey}`}>
                          <td className="lp-strong">{p.name}</td>
                          <td className="lp-hide-sm">{t(p.typeKey)}</td>
                          <td className="lp-end" style={{ paddingRight: 24 }}>
                            {format.eur(p.amountCents)}
                          </td>
                          <td className="lp-end">
                            <Chip tone={p.tone}>
                              {t(p.status.key, {
                                date: p.status.due ? format.dayMonth(p.status.due) : '',
                              })}
                            </Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="lp-panel-actions" aria-hidden="true">
                    <span>{t('landing.product.recordPayment')}</span>
                  </div>
                </>
              )}

              {active === 'invoices' && (
                <>
                  <div className="lp-panel-head">
                    <div className="lp-ui-title">{t('landing.product.invoicesTitle')}</div>
                  </div>
                  <table className="lp-table">
                    <thead>
                      <tr>
                        <th scope="col" className="lp-hide-sm">
                          {t('landing.product.colNumber')}
                        </th>
                        <th scope="col">{t('landing.product.colClient')}</th>
                        <th scope="col" className="lp-end">
                          {t('landing.product.colAmount')}
                        </th>
                        <th scope="col" className="lp-end">
                          {t('landing.product.colStatus')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {INVOICES.map((inv) => (
                        <tr key={inv.number}>
                          <td className="lp-mono lp-hide-sm" style={{ fontSize: '0.78rem' }}>
                            {inv.number}
                          </td>
                          <td className="lp-strong">{inv.name}</td>
                          <td className="lp-end" style={{ paddingRight: 24 }}>
                            {format.eur(inv.amountCents)}
                          </td>
                          <td className="lp-end">
                            <Chip tone={inv.tone}>{t(inv.statusKey)}</Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="lp-panel-actions" aria-hidden="true">
                    <span>{t('landing.product.newInvoice')}</span>
                    <span>{t('landing.product.pdf')}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
