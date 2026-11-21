// Canonical public origin of the site. Used for canonical/OG/JSON-LD URLs, sitemap.xml and robots.txt.
// The Netlify default domain (devtool-moya.netlify.app) redirects here once the custom domain is primary.
export const SITE_URL = 'https://tool.mehmetoya.com';
// Origins the site was published under before; gen-site rewrites them to SITE_URL in page heads.
export const PREVIOUS_ORIGINS = ['https://devtool-moya.netlify.app'];
