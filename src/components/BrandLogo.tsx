import { useTheme } from '../theme';

/** Optimized copies of the two team-supplied logos; no artwork or wording redrawn. */
export function BrandLogo({ className = '' }: { className?: string }) {
  const { theme } = useTheme();
  const src = theme === 'dark'
    ? '/brand/bharat-rail-dark.webp'
    : '/brand/bharat-rail-light.webp';

  return <img
    className={['brand-logo', className].filter(Boolean).join(' ')}
    src={src}
    alt="Bharat Rail ITSM — For Every Journey"
    width={900}
    height={212}
    decoding="async"
  />;
}
