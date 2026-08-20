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

/**
 * The English dictionary, assembled from one file per surface. Keys stay flat
 * and dot-namespaced (`bookings.title`) — the file split is organisational, so
 * moving a key between files never touches a call site.
 */
export const en = {
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
};
