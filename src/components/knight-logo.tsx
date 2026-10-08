// Knight FM — official brand logo component.
// The master asset (/knight-logo.png) is the club crest supplied by the owner:
// background cleaned to full transparency, "Made with AI" watermark removed,
// cropped to content. The favicon/apple icons are the crest crop served via the
// Next.js file conventions (src/app/icon.png + src/app/apple-icon.png).
import Image from "next/image";

/** width/height ratio of the cleaned master asset (719×698). */
const RATIO = 719 / 698;

export function KnightLogo({
  size = 36,
  className = "",
  priority = false,
  eager = false,
}: {
  /** Rendered height in px; width follows the natural asset ratio. */
  size?: number;
  className?: string;
  priority?: boolean;
  /** Force `loading="eager"` without the preload/high-fetchpriority of
   * `priority`. Use for below-the-fold instances: next/image's dev LCP check
   * keys its registry by URL, so ANY lazy instance of the same src would
   * otherwise trigger a false "add loading=eager" warning for the hero. */
  eager?: boolean;
}) {
  const height = Math.max(12, Math.round(size));
  const width = Math.max(12, Math.round(size * RATIO));
  return (
    <Image
      src="/knight-logo.png"
      alt="Knight FM"
      width={width}
      height={height}
      priority={priority}
      loading={eager && !priority ? "eager" : undefined}
      className={className}
      // The master asset is already sized and optimized (719×698, ~120 KB,
      // quantized). Serving it directly avoids the dev-mode image optimizer,
      // which can leave resized variants pending and blank the brand crest.
      unoptimized
    />
  );
}
