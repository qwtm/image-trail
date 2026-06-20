const dataThumbnailObjectUrls = new Map<string, string>();

export function thumbnailSourceForDom(thumbnail: string): string {
  if (!thumbnail.startsWith('data:image/')) return thumbnail;
  const cached = dataThumbnailObjectUrls.get(thumbnail);
  if (cached) return cached;

  const blob = dataImageUrlToBlob(thumbnail);
  if (!blob) return thumbnail;
  const objectUrl = URL.createObjectURL(blob);
  dataThumbnailObjectUrls.set(thumbnail, objectUrl);
  return objectUrl;
}

export function revokeThumbnailObjectUrls(): void {
  for (const objectUrl of dataThumbnailObjectUrls.values()) {
    URL.revokeObjectURL(objectUrl);
  }
  dataThumbnailObjectUrls.clear();
}

function dataImageUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/iu.exec(dataUrl);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]!.replace(/\s/gu, '')), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: match[1]!.toLowerCase() });
  } catch {
    return null;
  }
}
