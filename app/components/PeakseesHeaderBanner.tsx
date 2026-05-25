import Image from "next/image";

import {
  PEAKSEES_HEADER_BANNER,
  PEAKSEES_HEADER_BANNER_DARK,
} from "@/lib/brand";

type PeakseesHeaderBannerProps = {
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/** Light + dark header assets (dark PNG has transparent letter counters). */
export function PeakseesHeaderBanner({
  alt = "peaksees — prediction markets",
  width = 720,
  height = 220,
  className = "h-auto w-full object-contain",
  sizes,
  priority = false,
}: PeakseesHeaderBannerProps) {
  return (
    <>
      <Image
        src={PEAKSEES_HEADER_BANNER}
        alt={alt}
        width={width}
        height={height}
        className={className + " dark:hidden"}
        sizes={sizes}
        priority={priority}
      />
      <Image
        src={PEAKSEES_HEADER_BANNER_DARK}
        alt={alt}
        width={width}
        height={height}
        className={className + " hidden dark:block"}
        sizes={sizes}
        priority={priority}
      />
    </>
  );
}
