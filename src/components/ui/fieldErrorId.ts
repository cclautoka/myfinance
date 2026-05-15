/** Stable id for `aria-describedby` linking inputs to `FieldError`. */
export function fieldErrorId(fieldKey: string): string {
  return `field-error-${fieldKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}
