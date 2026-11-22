import { useTheme } from '../theme';

/**
 * The team's logo. One artwork in two colourings: navy text for light backgrounds and a recoloured
 * copy with light text for dark backgrounds (orange and green unchanged), both with transparent
 * backgrounds. The top bar is light teal in light mode and deep teal in dark mode, so it uses the same copy as the page.
 */
export function BrandLogo({ className = '' }: { className?: string }) {
  const { theme } = useTheme();
  const darkBackground = theme === 'dark';   // the top bar follows the theme: light teal or deep teal
  const src = darkBackground ? '/brand/bharat-rail-dark.webp' : '/brand/bharat-rail-light.webp';

  return <img
    className={['brand-logo', className].filter(Boolean).join(' ')}
    src={src}
    alt="Bharat Rail ITSM — For Every Journey"
    width={350}
    height={83}
    decoding="async"
  />;
}
