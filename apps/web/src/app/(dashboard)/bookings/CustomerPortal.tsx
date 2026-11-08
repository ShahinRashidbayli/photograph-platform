'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { Invoice } from '@/types/api';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { startOfToday } from '@/lib/date';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Note } from '@/components/ui';
import { StripePaymentModal } from '@/components/StripePaymentModal';
import { useBookings } from '@/hooks/useBookings';
import { useCustomerContracts } from '@/hooks/useContracts';
import { useCustomerInvoices } from '@/hooks/useInvoices';
import { useCustomerGalleries } from '@/hooks/useGalleries';
import { useCustomerInquiryRequests } from '@/hooks/useInquiryRequests';
import { usePublicTenantLegal } from '@/hooks/useTenantLegal';
import { greetingName, type PortalData } from './customer.portal';
import { getPortalStyles } from './customer.styles';
import { CustomerHome } from './CustomerHome';
import { CustomerBookingDetail } from './CustomerBookingDetail';
import type { StudioContact } from './PortalParts';

const RequestSessionModal = dynamic(
  () => import('./RequestSessionModal').then((m) => m.RequestSessionModal),
  { ssr: false }
);

/**
 * The client's side of `/bookings`: the overview, or one shoot when the URL
 * names it (`?id=`), so a refresh, the back button and a link in an email all
 * land on the same thing.
 *
 * <p>Every source the portal reads is its own query. Only the bookings are
 * essential; if contracts, invoices or galleries fail, the page still renders
 * from what arrived and says that something may be missing — a client who
 * cannot see their shoot because the gallery list timed out is worse off than
 * one told that a part is incomplete.
 */
export function CustomerPortal() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);
  const s = getPortalStyles(c);
  const user = useAuthStore((st) => st.user);
  const subdomain = user?.tenant?.subdomain ?? null;
  const selectedId = useSearchParams().get('id');

  const bookingsQ = useBookings(false);
  const contractsQ = useCustomerContracts();
  const invoicesQ = useCustomerInvoices();
  const galleriesQ = useCustomerGalleries();
  const requestsQ = useCustomerInquiryRequests();
  const legalQ = usePublicTenantLegal(subdomain);

  const [paying, setPaying] = useState<Invoice | null>(null);
  const [requesting, setRequesting] = useState(false);

  const data: PortalData = useMemo(
    () => ({
      today: startOfToday(),
      contracts: contractsQ.data ?? [],
      invoices: invoicesQ.data ?? [],
      galleries: galleriesQ.data ?? [],
    }),
    [contractsQ.data, invoicesQ.data, galleriesQ.data]
  );

  const studio: StudioContact = {
    name: legalQ.data?.legalName?.trim() || studioFromSubdomain(subdomain),
    email: legalQ.data?.legalEmail?.trim() || null,
    phone: legalQ.data?.legalPhone?.trim() || null,
  };

  if (bookingsQ.isLoading) {
    return (
      <div style={s.page}>
        <Note>{t('bookings.loading')}</Note>
      </div>
    );
  }
  if (bookingsQ.isError) {
    return (
      <div style={s.page}>
        <Alert tone="danger">{t('portal.loadError')}</Alert>
        <Button style={{ alignSelf: 'flex-start' }} onClick={() => bookingsQ.refetch()}>
          {t('common.tryAgain')}
        </Button>
      </div>
    );
  }

  const bookings = bookingsQ.data ?? [];
  const partial = contractsQ.isError || invoicesQ.isError || galleriesQ.isError;

  return (
    <>
      {partial && (
        <div style={{ ...s.page, paddingBottom: 0, gap: 0 }}>
          <Alert tone="warning">{t('portal.partialError')}</Alert>
        </div>
      )}
      {selectedId ? (
        <CustomerBookingDetail
          booking={bookings.find((b) => b.id === selectedId) ?? null}
          data={data}
          studio={studio}
          subdomain={subdomain}
          colors={c}
          onPay={setPaying}
        />
      ) : (
        <CustomerHome
          greeting={greetingName(user?.fullName)}
          bookings={bookings}
          data={data}
          requests={requestsQ.data ?? []}
          studio={studio}
          subdomain={subdomain}
          colors={c}
          onPay={setPaying}
          onRequest={() => setRequesting(true)}
        />
      )}

      {paying && (
        <StripePaymentModal
          invoice={paying}
          outstandingCents={paying.outstandingCents}
          onClose={() => setPaying(null)}
        />
      )}
      {requesting && (
        <RequestSessionModal email={user?.email ?? null} onClose={() => setRequesting(false)} />
      )}
    </>
  );
}

/**
 * "anna-foto" → "Anna Foto": a readable stand-in until the studio fills in its
 * Impressum, which is where the real name comes from.
 */
function studioFromSubdomain(subdomain: string | null): string | null {
  if (!subdomain) return null;
  return subdomain
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
