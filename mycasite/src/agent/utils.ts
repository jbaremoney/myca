// Helper function to generate UUIDs
export function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract raw base64 from data URL
 * Converts "data:image/png;base64,iVBORw0KG..." to "iVBORw0KG..."
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  if (dataUrl.includes(",")) {
    return dataUrl.split(",")[1];
  }
  return dataUrl;
}