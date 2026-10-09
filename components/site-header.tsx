import Link from "next/link";
import { NavLinks } from "@/components/nav-links";

/** The sticky top bar: the logo and the planning pages, search centered between them and Profile on the right. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-bg shadow-[0_1px_0_var(--color-line)]">
      <div className="mx-auto flex h-16 max-w-page items-center gap-8 px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-md"
        >
          <LogoMark />
          <span className="font-display font-semibold text-base [font-stretch:112.5%] max-[1259px]:sr-only">
            Plan Your Degree
          </span>
        </Link>
        <nav aria-label="Main" className="min-w-0 flex-1">
          <NavLinks />
        </nav>
      </div>
    </header>
  );
}

/** The red tile with the martlet rising out of the ring, in the small-size drawing (brand/masters/pyd-tile-small.svg). */
function LogoMark() {
  return (
    <svg aria-hidden viewBox="0 0 256 256" className="size-7 shrink-0">
      <rect width="256" height="256" rx="64" fill="#da1a2e" />
      <path
        fill="#fff"
        d="M184.99 125.8C184.99 163.84 154.15 194.68 116.11 194.68C78.07 194.68 47.23 163.84 47.23 125.8C47.23 87.76 78.07 56.92 116.11 56.92C128.91 56.92 140.89 60.41 151.16 66.49Q149.69 68.6 148.18 70.92Q145.39 75.21 143.91 77.3Q143.22 78.18 142.5 79.05Q140.97 79.79 139.4 80.6C132.42 76.99 124.5 74.96 116.11 74.96C88.03 74.96 65.27 97.72 65.27 125.8C65.27 153.88 88.03 176.64 116.11 176.64C144.19 176.64 166.95 153.88 166.95 125.8C166.95 121.61 166.44 117.53 165.48 113.63Q174.51 109.34 180.93 104.42Q181.2 104.22 181.47 104.01C183.75 110.86 184.99 118.18 184.99 125.8ZM208.95 56.71 200.62 68.43C196.92 78.59 188.58 90.3 176.94 99.22C165.3 108.14 143.93 115.86 122.84 120.7L91.22 150.26L109.51 119.6L108.07 119.67C101.33 121.89 94.4 123.98 87.38 125.91C89.57 124 91.76 122.13 93.93 120.31L73.96 121.21L102.42 113.33C118.01 100.85 132.86 90.84 146.62 84.35C147.48 83.33 148.33 82.29 149.17 81.22C155.42 72.43 160.21 62.61 169.39 55.91C178.23 50.29 189.39 50.73 196 56.32Z"
      />
    </svg>
  );
}
