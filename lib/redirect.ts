export function safeLocalRedirectPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const localOrigin = "http://local";
    const url = new URL(value, localOrigin);
    if (url.origin !== localOrigin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
