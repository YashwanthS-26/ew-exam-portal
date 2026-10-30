// Authoritative application version configuration
export const REQUIRED_APP_VERSION = process.env.REQUIRED_APP_VERSION || '1.1';

/**
 * Normalizes version strings for reliable comparison.
 * Handles forms like "1.1", "1.1.0", "v1.1", " v1.1.0 ".
 * Trailing zeroes after minor version are stripped so "1.1.0" == "1.1".
 */
export function normalizeVersion(v: string | undefined | null): string {
    if (!v) return '';
    const clean = String(v).trim().replace(/^v/i, '');
    const parts = clean.split('.');
    while (parts.length > 2 && parts[parts.length - 1] === '0') {
        parts.pop();
    }
    return parts.join('.');
}

/**
 * Validates student client version against required version.
 * Requires exact normalized equality (e.g. 1.1 matches 1.1, while 1.0, 1.2, 2.0 fail).
 */
export function validateAppVersion(clientVersion: string | undefined | null): {
    valid: boolean;
    requiredVersion: string;
    clientVersion: string;
} {
    const required = REQUIRED_APP_VERSION.trim();
    const client = String(clientVersion || '').trim();
    const normClient = normalizeVersion(client);
    const normRequired = normalizeVersion(required);

    const valid = normClient !== '' && normClient === normRequired;

    return {
        valid,
        requiredVersion: required,
        clientVersion: client || 'Unknown',
    };
}
