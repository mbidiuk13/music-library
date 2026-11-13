//CSP дозволяє лише власний домен, крім аудіо з S3 (pre-signed URL) і шрифту Inter з Google Fonts
import helmet from 'helmet';

export const GOOGLE_FONTS_STYLES = 'https://fonts.googleapis.com';

export const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';

//бакети з крапкою в назві несумісні з TLS-сертифікатом `*.s3…`, тому SDK дає для них URL у стилі шляху
export function s3MediaOrigin({ bucket, region }) {
  if (!bucket || !region) return null;
  return bucket.includes('.')
    ? `https://s3.${region}.amazonaws.com`
    : `https://${bucket}.s3.${region}.amazonaws.com`;
}

export function buildCspDirectives(s3) {
  const mediaOrigin = s3MediaOrigin(s3);
  return {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'script-src': ["'self'"],
    'script-src-attr': ["'none'"],
    'style-src': ["'self'", GOOGLE_FONTS_STYLES],
    'font-src': ["'self'", GOOGLE_FONTS_FILES],
    'img-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'media-src': mediaOrigin ? ["'self'", mediaOrigin] : ["'self'"],
  };
}

//без upgrade-insecure-requests: HTTPS дає nginx, а на http://localhost вона ламала б ресурси
export default function securityHeaders(s3) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: buildCspDirectives(s3),
    },
  });
}
