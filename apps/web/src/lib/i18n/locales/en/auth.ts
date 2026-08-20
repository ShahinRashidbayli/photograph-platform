/**
 * Sign-in, registration and the customer magic-link flow.
 *
 * English is the source of truth — these keys define the `Auth` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const auth = {
  // ── Customer magic-link login ─────────────────────────────────────────────
  'customerLogin.visualTitle': 'Your photos, your moments',
  'customerLogin.visualSubtitle':
    'Sign in to track your booking, view your gallery and message your photographer.',
  'customerLogin.photographerSignIn': 'Photographer sign in',
  'customerLogin.title': 'Sign in as a client',
  'customerLogin.subtitle':
    "Enter your email and your photographer's subdomain — we'll send you a one-time link to sign in. No password needed.",
  'customerLogin.emailLabel': 'Email address',
  'customerLogin.subdomainLabel': 'Photographer subdomain',
  'customerLogin.subdomainHelper': 'The subdomain your photographer shared with you.',
  'customerLogin.subdomainHelperLocked': "You're signing in on your photographer's site.",
  'customerLogin.fullNameLabel': 'Full name (optional)',
  'customerLogin.fullNameHelper': 'Only used the first time you sign in.',
  'customerLogin.submit': 'Send me a magic link →',
  'customerLogin.submitLoading': 'Sending link…',
  'customerLogin.footer':
    'First time here? No sign-up needed — entering your details sets up your account automatically.',
  'customerLogin.errorRequired': 'Email and photographer subdomain are required',
  'customerLogin.errorEmail': 'Please enter a valid email address',
  'customerLogin.errorSubdomain': 'Please enter a valid photographer subdomain (e.g. anna-foto)',
  'customerLogin.errorSend': 'Could not send magic link. Please try again.',
  'customerLogin.sentTitle': 'Check your inbox',
  'customerLogin.sentBody':
    'If {email} is registered with that photographer, we just sent you a sign-in link. It’s valid for 15 minutes.',
  'customerLogin.sentHint': "Didn't get it? Check your spam folder, or request a new one below.",
  'customerLogin.resend': 'Resend link',
  'customerLogin.resendLoading': 'Resending…',
  'customerLogin.resendDone': 'Sent! Check your inbox again.',

  // ── Photographer login ────────────────────────────────────────────────────
  'login.crossLink': 'Client sign in',
  'login.title': 'Welcome back',
  'login.subtitle': 'Sign in to your Fotolio studio.',
  'login.emailLabel': 'Email address',
  'login.passwordLabel': 'Password',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.forgot': 'Forgot password?',
  'login.submit': 'Sign in',
  'login.submitLoading': 'Signing in…',
  'login.noAccount': "Don't have an account?",
  'login.createOne': 'Create one',
  'login.errorRequired': 'Email and password are required',
  'login.errorInvalid': 'Invalid email or password',
  'login.errorGeneric': 'Login failed',

  // ── Photographer registration ─────────────────────────────────────────────
  'register.crossLink': 'Sign in',
  'register.visualTitle': 'Grow your photography business',
  'register.visualSubtitle':
    'A 14-day free trial. No credit card. Your own booking site in minutes.',
  'register.title': 'Create your studio',
  'register.planNote': 'You picked the {plan} plan — free for 14 days, change it anytime.',
  'register.planChange': 'Compare plans',
  'register.subtitle': '14-day free trial · No credit card required',
  'register.fullNameLabel': 'Full name',
  'register.emailLabel': 'Email address',
  'register.subdomainLabel': 'Your subdomain',
  'register.subdomainHelper': '3–63 characters · lowercase letters, digits and hyphens',
  'register.passwordLabel': 'Password',
  'register.passwordHelper': 'Min. 10 characters, with at least one letter and one digit',
  'register.pwWeak': 'Weak',
  'register.pwMedium': 'Medium',
  'register.pwStrong': 'Strong',
  'register.submit': 'Create studio',
  'register.submitLoading': 'Creating studio…',
  'register.alreadyAccount': 'Already have an account?',
  'register.signIn': 'Sign in',
  'register.bookingQuestion': 'Booking with a photographer?',
  'register.clientSignIn': 'Client sign in',
  'register.successTitle': 'Welcome to Fotolio!',
  'register.successBody':
    'Your studio is live at {subdomain}.fotolio.de. Redirecting to your dashboard…',
  'register.errorAllRequired': 'All fields are required',
  'register.errorEmail': 'Please enter a valid email address',
  'register.errorPasswordLength': 'Password must be at least 10 characters',
  'register.errorPasswordComposition': 'Password must contain at least one letter and one digit',
  'register.errorSubdomain':
    'Subdomain must be 3–63 chars, start and end with a letter or digit, hyphens allowed in between',
  'register.errorGeneric': 'Registration failed',
} as const;

export type EnAuth = typeof auth;
