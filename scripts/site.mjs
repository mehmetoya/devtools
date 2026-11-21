// Canonical public origin of the site. Used for canonical/OG/JSON-LD URLs, sitemap.xml and robots.txt.
// The Netlify default domain (devtool-moya.netlify.app) redirects here once the custom domain is primary.
export const SITE_URL = 'https://tool.mehmetoya.com';
// Origins the site was published under before; gen-site rewrites them to SITE_URL in page heads.
// The maker; used for author metadata, llms.txt and security.txt.
export const AUTHOR = { name: 'Mehmet Oya', url: 'https://mehmetoya.com', contact: 'https://mehmetoya.com/contact/' };
// security.txt must carry an expiry; scripts/check.mjs fails the build 30 days before it so it gets renewed.
export const SECURITY_TXT_EXPIRES = '2027-11-21T00:00:00.000Z';
export const PREVIOUS_ORIGINS = ['https://devtool-moya.netlify.app'];
