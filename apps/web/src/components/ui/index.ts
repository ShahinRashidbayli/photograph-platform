/**
 * The shared UI layer.
 *
 * <p>The app has ~900 hand-written inline style objects and had no `Button`:
 * every screen restated padding, radius, colour and hover behaviour for
 * itself, so "the primary button" was a convention held together by
 * copy-paste. These primitives exist to own those decisions instead.
 *
 * <h2>Adoption is partial — read this before assuming otherwise</h2>
 * Only the invoicing and settings screens import from here so far. Everything
 * else still hand-rolls its own buttons and dialogs, including
 * `StripePaymentModal` and `ConfirmDialog`, both of which `Modal` could serve.
 * So this is the direction, not the current state: the inline-style count has
 * not meaningfully moved yet, and a screen you are editing is more likely than
 * not to still be on the old pattern. Migrate the screen you are touching
 * rather than adding to it.
 *
 * <p>These deliberately stay on inline styles with the existing design tokens
 * rather than introducing a styling library — the problem was duplication, not
 * the technique, and a CSS migration is a larger change than it would repay.
 */
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Card, type CardProps } from './Card';
export {
  Field,
  Input,
  Select,
  Textarea,
  type InputProps,
  type SelectProps,
  type TextareaProps,
} from './Field';
export { Alert, type AlertProps, type AlertTone } from './Alert';
export { Badge, type BadgeProps } from './Badge';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Note } from './Note';
export { Modal, ModalHeader, type ModalProps } from './Modal';
export { useColors, RADIUS, type Colors } from './tokens';
