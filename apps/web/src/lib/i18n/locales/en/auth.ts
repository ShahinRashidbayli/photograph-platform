/**
 * Sign-in, registration and the customer login-code flow.
 *
 * English is the source of truth — these keys define the `Auth` half of
 * `TranslationKey`, and every other locale is compile-checked against it.
 */
export const auth = {
  // ── Customer sign-in by emailed code ──────────────────────────────────────
  // A code, not a link: clients arrive from an Instagram bio link, so the page
  // is inside Instagram's in-app browser and a link would send them out to
  // their mail app and back through a different browser. The wording below
  // leans on "stay on this page" for exactly that reason.
  'customerLogin.visualTitle': 'Your photos, your moments',
  'customerLogin.visualSubtitle':
    'Sign in to track your booking, view your gallery and message your photographer.',
  'customerLogin.photographerSignIn': 'Photographer sign in',
  'customerLogin.title': 'Sign in as a client',
  'customerLogin.subtitle':
    "Enter your email and your photographer's subdomain — we'll send you a 6-digit code. No password needed.",
  'customerLogin.emailLabel': 'Email address',
  'customerLogin.subdomainLabel': 'Photographer subdomain',
  'customerLogin.subdomainHelper': 'The subdomain your photographer shared with you.',
  'customerLogin.subdomainHelperLocked': "You're signing in on your photographer's site.",
  'customerLogin.fullNameLabel': 'Full name (optional)',
  'customerLogin.fullNameHelper': 'Only used the first time you sign in.',
  'customerLogin.submit': 'Send me a code →',
  'customerLogin.submitLoading': 'Sending code…',
  'customerLogin.footer':
    'First time here? No sign-up needed — entering your details sets up your account automatically.',
  'customerLogin.errorRequired': 'Email and photographer subdomain are required',
  'customerLogin.errorEmail': 'Please enter a valid email address',
  'customerLogin.errorSubdomain': 'Please enter a valid photographer subdomain (e.g. anna-foto)',
  'customerLogin.errorSend': 'Could not send the code. Please try again.',
  'customerLogin.sentTitle': 'Enter your code',
  'customerLogin.sentBody':
    'If {email} is registered with that photographer, we just sent a 6-digit code. It expires in 10 minutes.',
  'customerLogin.sentHint':
    'Keep this page open — open your email, then come back and type the code here.',
  'customerLogin.codeLabel': '6-digit code',
  'customerLogin.codeSubmit': 'Sign in →',
  'customerLogin.codeSubmitLoading': 'Signing in…',
  'customerLogin.errorCodeFormat': 'Please enter the 6-digit code from your email',
  'customerLogin.errorCodeInvalid': "That code isn't valid. Request a new one below.",
  'customerLogin.changeEmail': '← Use a different email',
  'customerLogin.resend': 'Send a new code',
  'customerLogin.resendLoading': 'Sending…',
  'customerLogin.resendDone': 'Sent! Check your inbox again.',
  'customerLogin.resendIn': 'Resend in {wait}',
  'customerLogin.resendError': 'Could not send another code. Please try again.',
  'customerLogin.resendLimited':
    'You’ve already requested several codes. Please wait a little before asking for another.',
  'customerLogin.resendLimitedFor':
    'You’ve already requested several codes. You can ask for another in {wait}.',

  // ── Photographer login ────────────────────────────────────────────────────
  'login.crossLink': 'Client sign in',
  // The brand panel beside the sign-in form. Addressed to a photographer
  // returning to their own studio — the screen used to fall back to
  // "Discover great photographers", which is what a *client* would be told.
  'login.visualTitle': 'Your studio, right where you left it.',
  'login.visualSubtitle': 'Bookings, clients and galleries — all in one place.',
  'login.title': 'Welcome back',
  'login.subtitle': 'Sign in to your Fotolio studio.',
  'login.emailLabel': 'Email address',
  'login.passwordLabel': 'Password',
  'login.forgot': 'Forgot password?',
  'login.submit': 'Sign in',
  'login.submitLoading': 'Signing in…',
  'login.noAccount': "Don't have an account?",
  'login.createOne': 'Create one',
  'login.errorRequired': 'Email and password are required',
  'login.errorInvalid': 'Invalid email or password',
  // A lockout is its own message. Reporting it as "invalid password" told
  // someone typing the *correct* password that it was wrong, for 15 minutes,
  // with nothing on screen suggesting a wait.
  'login.errorLocked':
    'Too many failed sign-in attempts. Please wait a few minutes before trying again.',
  'login.errorLockedFor': 'Too many failed sign-in attempts. You can try again in {wait}.',
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
  'register.successVerifyNote':
    'One more thing: we’ve emailed {email} a confirmation link. Until you click it, we can’t send booking mails or invoices on your behalf.',
  'register.goToDashboard': 'Go to my dashboard',
  'register.errorEmail': 'Please enter a valid email address',
  'register.errorPasswordLength': 'Password must be at least 10 characters',
  'register.errorPasswordComposition': 'Password must contain at least one letter and one digit',
  'register.errorSubdomain':
    'Subdomain must be 3–63 chars, start and end with a letter or digit, hyphens allowed in between',
  'register.errorGeneric': 'Registration failed',
  'register.errorRateLimited':
    'Too many sign-up attempts from this network. Please try again later.',
  'register.errorRateLimitedFor':
    'Too many sign-up attempts from this network. You can try again in {wait}.',
  // ── Email confirmation (link from the inbox) ──────────────────────────────
  'verifyEmail.visualTitle': 'One click and you’re confirmed.',
  'verifyEmail.visualSubtitle':
    'A confirmed address is what lets us send booking mails and invoices on your behalf.',
  'verifyEmail.loadingTitle': 'Confirming your email',
  'verifyEmail.loadingBody': 'One moment — we’re checking your link.',
  'verifyEmail.successTitle': 'Email confirmed',
  'verifyEmail.successBody':
    'Your address is confirmed. You can close this tab, or carry on to your dashboard.',
  'verifyEmail.errorTitle': 'Verification failed',
  'verifyEmail.errorMissingToken':
    'This link is missing its token. Open it straight from the email rather than copying it, or request a new one from your dashboard.',
  'verifyEmail.errorInvalid':
    'This confirmation link is invalid or has expired. You can request a new one from your dashboard.',
  'verifyEmail.goToDashboard': 'Go to dashboard',
  'verifyEmail.signIn': 'Sign in',

  // ── Password recovery: request a link ─────────────────────────────────────
  'forgot.visualTitle': 'Locked out? It happens.',
  'forgot.visualSubtitle': 'We’ll get you back into your studio in no time.',
  'forgot.title': 'Reset your password',
  'forgot.subtitle': 'Enter your email address and we’ll send you a link to choose a new password.',
  'forgot.emailLabel': 'Email address',
  'forgot.submit': 'Send reset link',
  'forgot.submitLoading': 'Sending link…',
  'forgot.errorRequired': 'Enter the email address on your account.',
  'forgot.errorSend': 'Could not send the reset link. Please try again.',
  'forgot.errorRateLimited': 'Too many reset requests. Please try again later.',
  'forgot.errorRateLimitedFor': 'Too many reset requests. You can try again in {wait}.',
  'forgot.sentVisualTitle': 'Check your inbox.',
  'forgot.sentVisualSubtitle': 'The link is good for one hour.',
  'forgot.sentTitle': 'Check your email',
  // Deliberately conditional: the backend will not say whether the address is
  // on file, and neither may this screen.
  'forgot.sentBody':
    'If an account exists for {email}, we’ve sent it a link to choose a new password. It expires in an hour and can only be used once.',
  'forgot.sentHint': 'Nothing arrived? Check your spam folder, then try again in a few minutes.',
  'forgot.backToSignIn': 'Back to sign in',
  'forgot.clientTip':
    'Are you a client? You don’t need a password — use the sign-in link your photographer emailed you.',
  'forgot.remembered': 'Remembered it?',

  // ── Password recovery: choose the new password ────────────────────────────
  'reset.visualTitle': 'Choose a new password.',
  'reset.visualSubtitle': 'Make it something only you would pick.',
  'reset.title': 'Set a new password',
  'reset.subtitle': 'At least {min} characters, with a letter and a digit.',
  'reset.passwordLabel': 'New password',
  'reset.confirmLabel': 'Confirm new password',
  'reset.submit': 'Update password',
  'reset.submitLoading': 'Updating…',
  'reset.errorLength': 'Password must be at least {min} characters.',
  'reset.errorComposition': 'Password must contain at least one letter and one digit.',
  'reset.errorMismatch': 'The two passwords don’t match.',
  'reset.errorInvalidLink': 'This reset link is no longer valid. Request a new one and try again.',
  'reset.errorGeneric': 'Could not reset your password. Please try again.',
  'reset.missingVisualTitle': 'That link looks incomplete.',
  'reset.missingVisualSubtitle': 'The link has to arrive whole to work.',
  'reset.missingTitle': 'Link is missing its token',
  'reset.missingBody': 'Open the link straight from the email, or request a fresh one.',
  'reset.requestNew': 'Request a new link',
  'reset.doneVisualTitle': 'You’re all set.',
  'reset.doneVisualSubtitle': 'Sign in with your new password.',
  'reset.doneTitle': 'Password updated',
  'reset.doneBody':
    'You’ve been signed out everywhere else for safety. Sign in with your new password to continue.',
  'reset.goToSignIn': 'Go to sign in',
  'reset.backToSignIn': 'Back to sign in',

  // ── Sign-up: confirmation, consent and live subdomain checking ────────────
  'register.confirmLabel': 'Confirm password',
  'register.errorConfirmRequired': 'Please repeat your password.',
  'register.errorConfirmMismatch': 'The two passwords don’t match.',
  'register.errorFullName': 'Please enter your name.',
  // §5 DDG / DSGVO: a German commercial sign-up has to take an explicit,
  // unticked opt-in to the terms, and must link both documents at the point of
  // consent.
  'register.terms': 'I accept the {agb} and have read the {privacy}.',
  'register.termsAgb': 'Terms of Service',
  'register.termsPrivacy': 'Privacy Policy',
  'register.errorTerms': 'Please accept the terms and the privacy policy to continue.',
  'register.subdomainChecking': 'Checking availability…',
  'register.subdomainAvailable': '{subdomain}.fotolio.de is free — it’s yours.',
  'register.subdomainTaken': 'That address is already taken. Try another.',
  'register.subdomainReserved': 'That address is reserved. Please choose another.',
  'register.subdomainTooShort': 'At least 3 characters.',
  // ── Invitation acceptance (/invite) ───────────────────────────────────────
  // Joining someone else's studio. A sign-up, but for a seat rather than a new
  // studio — hence the (auth) group and the shared split layout.
  'invite.checking': 'Checking your invitation…',
  'invite.title': 'Join {studio}',
  'invite.subtitle':
    'Set a password and you are in. You will see the same bookings, clients and galleries as the rest of {studio}.',
  'invite.emailLabel': 'Your email',
  'invite.nameLabel': 'Your name',
  'invite.passwordLabel': 'Choose a password',
  'invite.passwordHelp': 'At least 10 characters, with a letter and a number.',
  'invite.join': 'Join the studio',
  'invite.joining': 'Creating your account…',
  'invite.error': 'We could not complete that. Please try again.',
  'invite.invalidTitle': 'This invitation is no longer valid',
  'invite.invalidBody':
    'It may have expired, been withdrawn, or already been used. Ask the studio owner to send a new one.',
  'invite.backToLogin': 'Go to sign in',
  'invite.haveAccount': 'Already have an account? Sign in',
  'invite.visualTitle': 'One studio, one workspace',
  'invite.visualSubtitle':
    'Bookings, clients and galleries — shared with the photographers you work with.',
} as const;

export type EnAuth = typeof auth;
