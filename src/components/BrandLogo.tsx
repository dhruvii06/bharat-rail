import { useTheme } from '../theme';

/**
 * The team's logo. One artwork in two colourings: navy text for light backgrounds and a recoloured
 * copy with light text for dark backgrounds (orange and green unchanged), both with transparent
 * backgrounds. The top bar is maroon in both themes, so it always uses the light-text copy.
 */
export function BrandLogo({ className = '', surface = 'page' }: { className?: string; surface?: 'page' | 'header' }) {
  const { theme } = useTheme();
  const darkBackground = surface === 'header' || theme === 'dark';
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
