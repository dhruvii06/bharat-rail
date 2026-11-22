/**
 * The team's logo. One artwork in two colourings: navy text for light backgrounds and a recoloured
 * copy with light text for dark backgrounds (orange and green unchanged), both with transparent
 * backgrounds. Both are rendered and CSS shows the one for the current theme, so switching themes
 * never waits for an image to load. The top bar follows the theme (light teal or deep teal).
 */
export function BrandLogo({ className = '' }: { className?: string }) {
  const common = { alt: 'Bharat Rail ITSM — For Every Journey', width: 350, height: 83, decoding: 'async' as const };
  return <>
    <img {...common} className={['brand-logo', 'brand-logo-light', className].filter(Boolean).join(' ')} src="/brand/bharat-rail-light.webp" />
    <img {...common} className={['brand-logo', 'brand-logo-dark', className].filter(Boolean).join(' ')} src="/brand/bharat-rail-dark.webp" alt="" aria-hidden="true" />
  </>;
}
