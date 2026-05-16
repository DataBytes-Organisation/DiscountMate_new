const DEFAULT_API_URL = "http://localhost:3000/api";

function stripTrailingSlash(value: string): string {
   return value.replace(/\/+$/, "");
}

function joinUrl(base: string, path: string): string {
   if (!path) {
      return base;
   }

   return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const API_URL = stripTrailingSlash(
   process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL
);

export const API_ROOT_URL = API_URL.endsWith("/api")
   ? API_URL.slice(0, -4)
   : API_URL;

export function buildApiUrl(path = ""): string {
   return joinUrl(API_URL, path);
}

export function buildRootUrl(path = ""): string {
   return joinUrl(API_ROOT_URL, path);
}

export const API_BASE_URL = API_ROOT_URL;
export const REVERSE_IMAGE_SEARCH_API_URL = buildApiUrl('/reverse-image-search');
