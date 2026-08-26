import { common } from './common';
import { auth } from './auth';
import { landing } from './landing';
import { chrome } from './chrome';
import { dashboard } from './dashboard';
import { bookings } from './bookings';
import { leads } from './leads';
import { clients } from './clients';
import { inquiries } from './inquiries';
import { invoices } from './invoices';
import { payments } from './payments';
import { galleries } from './galleries';
import { portfolio } from './portfolio';
import { settings } from './settings';
import { stubs } from './stubs';
import { analytics } from './analytics';

/** The German dictionary. Each namespace is typed against its English twin. */
export const de = {
  ...common,
  ...auth,
  ...landing,
  ...chrome,
  ...dashboard,
  ...bookings,
  ...leads,
  ...clients,
  ...inquiries,
  ...invoices,
  ...payments,
  ...galleries,
  ...portfolio,
  ...settings,
  ...stubs,
  ...analytics,
};
