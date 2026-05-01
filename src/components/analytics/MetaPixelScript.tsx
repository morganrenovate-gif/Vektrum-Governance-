/**
 * MetaPixelScript — server component.
 *
 * Renders the Meta Pixel base code using next/script (strategy="afterInteractive").
 * Renders nothing if NEXT_PUBLIC_META_PIXEL_ID is not set.
 *
 * The base script:
 *   1. Injects the fbevents.js loader into the page.
 *   2. Calls fbq('init', pixelId) — idempotent due to the `if(f.fbq)return` guard.
 *   3. Fires the initial fbq('track', 'PageView') for the landing page.
 *      Subsequent SPA route changes are handled by <MetaPixelPageView />.
 *
 * Safety:
 *   - NEXT_PUBLIC_META_PIXEL_ID is a public identifier — not a secret.
 *   - The pixel ID is rendered into the inline script at build/request time.
 *   - No user PII is collected by this component.
 *   - The noscript fallback img is placed in the body by the root layout.
 */

import Script from 'next/script'

export function MetaPixelScript() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID

  // Pixel ID not configured — render nothing. Safe for development / staging.
  if (!pixelId) return null

  return (
    <Script
      id="meta-pixel-base"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');
fbq('track','PageView');
`,
      }}
    />
  )
}
