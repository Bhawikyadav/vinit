// One icon system for the dashboard: 24×24, stroke-based, 1.75 weight, round
// caps and joins. Authored here so the whole shell shares a single visual voice
// (no emoji, no mixed icon packs). Color comes from `currentColor`.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </Svg>
);

export const IconReceipt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3.5h14v17l-2.3-1.4-2.35 1.4-2.35-1.4-2.35 1.4L5 20.5z" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  </Svg>
);

export const IconFile = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 2.75h7.5L18.5 7.5V21a.75.75 0 0 1-.75.75H6A.75.75 0 0 1 5.25 21V3.5A.75.75 0 0 1 6 2.75z" />
    <path d="M13 3v4.5h5" />
    <path d="M8.5 13h7M8.5 16.5h5" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 20c.6-3.1 2.9-5 5.5-5s4.9 1.9 5.5 5" />
    <path d="M16 4.3a3.25 3.25 0 0 1 0 6.4M17.5 14.3c2 .5 3.5 2.2 4 5.2" />
  </Svg>
);

export const IconChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 3.5v15a1.5 1.5 0 0 0 1.5 1.5h15.5" />
    <path d="M7.5 15.5V12M12 15.5V8M16.5 15.5v-4.5" />
  </Svg>
);

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.5v2.4M12 19.1v2.4M4.2 7.1l2.1 1.2M17.7 15.7l2.1 1.2M4.2 16.9l2.1-1.2M17.7 8.3l2.1-1.2" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const IconTrendUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 14.5 9.5 9l3.5 3.5L20 5.5" />
    <path d="M15 5.5h5v5" />
  </Svg>
);

export const IconArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Svg>
);

export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 4.2 1 5.6 1.8 6.5.5.6.1 1.5-.7 1.5H4.9c-.8 0-1.2-.9-.7-1.5C5 14.6 6 13.2 6 9z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
  </Svg>
);

export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 21H6a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 6 3h8" />
    <path d="M17 8.5 20.5 12 17 15.5M9.5 12h11" />
  </Svg>
);

export const IconBuilding = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h7A1.5 1.5 0 0 1 15 4.5V21" />
    <path d="M15 9h3.5A1.5 1.5 0 0 1 20 10.5V21M3.5 21h17" />
    <path d="M8 7h4M8 11h4M8 15h4" />
  </Svg>
);

export const IconBox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.75 20.25 7v10L12 21.25 3.75 17V7z" />
    <path d="M3.75 7 12 11.5 20.25 7" />
    <path d="M12 11.5v9.75" />
  </Svg>
);

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15.5V4M12 4 7.5 8.5M12 4l4.5 4.5" />
    <path d="M4.5 14.5V18A1.5 1.5 0 0 0 6 19.5h12a1.5 1.5 0 0 0 1.5-1.5v-3.5" />
  </Svg>
);

export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 13.5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V8.5A1.5 1.5 0 0 1 6 7h5.5" />
  </Svg>
);

export const IconSparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.6 10.4 12.2 5 10.6 10.4 9z" />
    <path d="M18.5 4v3M20 5.5h-3" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
