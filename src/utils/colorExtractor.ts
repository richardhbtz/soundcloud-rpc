/**
 * Utility for extracting colors from CSS theme files
 * Parses CSS custom properties and returns a structured color palette
 */

export interface ThemeColors {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    accent: string;
}

/**
 * Extract color values from CSS content
 * Looks for common CSS variable patterns used in themes
 */
export function extractThemeColors(cssContent: string): ThemeColors | null {
    if (!cssContent || cssContent.trim() === '') {
        return null;
    }

    const colors: Partial<ThemeColors> = {};

    // Helper to parse CSS color values (hex, rgb, rgba, hsl, hsla)
    const parseColorValue = (value: string): string | null => {
        if (!value) return null;

        // Clean up the value
        value = value
            .trim()
            .replace(/!important/gi, '')
            .trim();

        // Handle hex colors
        if (value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)) {
            return value;
        }

        // Handle rgb/rgba
        if (value.match(/^rgba?\(/i)) {
            return value;
        }

        // Handle hsl/hsla
        if (value.match(/^hsla?\(/i)) {
            return value;
        }

        // Handle named colors
        if (value.match(/^[a-z]+$/i)) {
            return value;
        }

        return null;
    };

    // Extract CSS variables from the content
    const extractVariable = (varName: string): string | null => {
        // Match --varName: value; or --varName: value !important;
        const regex = new RegExp(`--${varName}\\s*:\\s*([^;]+);`, 'i');
        const match = cssContent.match(regex);
        if (match && match[1]) {
            return parseColorValue(match[1]);
        }
        return null;
    };

    // Priority order for extracting colors
    // Try to find the most common variable names used in themes

    // Primary color (for accents, buttons, highlights)
    colors.primary =
        extractVariable('primary-color') ||
        extractVariable('button-primary-background-color') ||
        extractVariable('accent-color') ||
        extractVariable('highlight-color') ||
        extractVariable('artist-color') ||
        '#ff5500'; // SoundCloud orange fallback

    // Secondary color
    colors.secondary =
        extractVariable('secondary-color') ||
        extractVariable('button-secondary-background-color') ||
        extractVariable('artist-surface-color') ||
        '#a89984'; // Gruvbox secondary fallback

    // Background color
    colors.background =
        extractVariable('background-surface-color') ||
        extractVariable('surface-color') ||
        extractVariable('background-dark-color') ||
        extractVariable('background-base') ||
        '#1d2021'; // Gruvbox background fallback

    // Surface color (for cards, panels)
    colors.surface =
        extractVariable('surface-color') ||
        extractVariable('background-highlight-color') ||
        extractVariable('background-surface') ||
        '#282828'; // Gruvbox surface fallback

    // Text color
    colors.text =
        extractVariable('primary-color') ||
        extractVariable('font-primary-color') ||
        extractVariable('font-light-color') ||
        extractVariable('text-base') ||
        '#ebdbb2'; // Gruvbox text fallback

    // Accent color (for special elements)
    colors.accent =
        extractVariable('button-special-background-color') ||
        extractVariable('font-special-color') ||
        extractVariable('special-color') ||
        extractVariable('artist-pro-color') ||
        '#fe8019'; // Gruvbox accent fallback

    return colors as ThemeColors;
}

/**
 * Convert hex color to rgba with alpha
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
    // Remove # if present
    hex = hex.replace('#', '');

    // Handle 3-character hex
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((char) => char + char)
            .join('');
    }

    // Parse hex to rgb
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Extract RGB values from any color format
 */
export function extractRgb(color: string): { r: number; g: number; b: number } | null {
    // Handle hex
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        const fullHex =
            hex.length === 3
                ? hex
                      .split('')
                      .map((c) => c + c)
                      .join('')
                : hex;

        return {
            r: parseInt(fullHex.substring(0, 2), 16),
            g: parseInt(fullHex.substring(2, 4), 16),
            b: parseInt(fullHex.substring(4, 6), 16),
        };
    }

    // Handle rgb/rgba
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1]),
            g: parseInt(rgbMatch[2]),
            b: parseInt(rgbMatch[3]),
        };
    }

    return null;
}

/**
 * Calculate luminance of a color to determine if it's light or dark
 */
export function getLuminance(color: string): number {
    const rgb = extractRgb(color);
    if (!rgb) return 0.5;

    // Convert to relative luminance
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Determine if a color is light or dark
 */
export function isLightColor(color: string): boolean {
    return getLuminance(color) > 0.5;
}
