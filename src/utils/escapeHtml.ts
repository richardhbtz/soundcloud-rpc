/**
 * Escape a value for interpolation into HTML text or a double-quoted attribute.
 *
 * Settings pages are built by string concatenation and loaded as `data:` URLs with no
 * CSP, so an unescaped stored value that breaks out of an attribute executes in the
 * app's most privileged renderer. Everything interpolated into that markup goes through
 * here.
 */
export function escapeHtml(value: unknown): string {
    if (value === undefined || value === null) return '';

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
