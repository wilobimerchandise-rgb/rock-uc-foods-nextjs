/**
 * ROCK UC FOODS - Same-Site Origin Check
 * Playbook v4 Section 28
 * Rejects missing or foreign Origin on mutating API routes (403 Forbidden).
 */

export function isSameOrigin(request: Request): boolean {
  const originHeader = request.headers.get('origin');
  if (!originHeader) {
    return false;
  }

  try {
    const originUrl = new URL(originHeader);
    const hostHeader = request.headers.get('host') || request.headers.get('x-forwarded-host');

    if (!hostHeader) {
      return false;
    }

    // Compare origin hostname & port against host header
    // Normalize in case host header contains port
    const normalizedHost = hostHeader.toLowerCase().trim();
    const originHost = originUrl.host.toLowerCase().trim();

    return originHost === normalizedHost;
  } catch {
    return false;
  }
}
