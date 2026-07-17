import { common } from './common';
import { auth } from './auth';
import { landing } from './landing';
import { chrome } from './chrome';
import { dashboard } from './dashboard';
import { bookings } from './bookings';
import { leads } from './leads';
import { clients } from './clients';
import { inquiries } from './inquiries';

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
};
