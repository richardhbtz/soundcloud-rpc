/**
 * Escape a value for interpolation into HTML text or a quoted attribute. The settings and
 * confirm pages are built by string concatenation, so every stored or caller-supplied value
 * in that markup goes through here.
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
