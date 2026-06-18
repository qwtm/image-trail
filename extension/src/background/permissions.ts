export function extractOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export async function hasOriginPermission(origin: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [`${origin}/*`] });
}

export async function requestOriginPermission(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [`${origin}/*`] });
}
