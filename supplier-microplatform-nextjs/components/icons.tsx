import type { SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "projects"
  | "suppliers"
  | "users"
  | "settings"
  | "orders"
  | "logout"
  | "menu"
  | "close"
  | "chevron-right"
  | "inbox"
  | "file"
  | "check";

const paths: Record<IconName, string> = {
  dashboard:
    "M3.75 3.75h6v6h-6v-6Zm10.5 0h6v6h-6v-6ZM3.75 14.25h6v6h-6v-6Zm10.5 0h6v6h-6v-6Z",
  projects:
    "M3.75 6.75A2.25 2.25 0 0 1 6 4.5h3l1.5 2.25h7.5A2.25 2.25 0 0 1 20.25 9v8.25A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25V6.75Z",
  suppliers:
    "M4.5 20.25V6.75L12 3l7.5 3.75v10.5M8.25 20.25v-5.25h7.5v5.25M8.25 9.75h.008v.008H8.25V9.75Zm3.75 0h.008v.008H12V9.75Zm3.75 0h.008v.008h-.008V9.75Z",
  users:
    "M15 19.5v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 3 18v1.5M9 9.75a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 9.75v-1.5a4.5 4.5 0 0 0-3-4.243M15.75 4.007a3 3 0 0 1 0 5.486",
  settings:
    "M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Zm7.5-3.75c0 .55-.065 1.085-.187 1.598l1.94 1.51-1.875 3.248-2.302-.776a7.53 7.53 0 0 1-2.764 1.598L13.875 21.75h-3.75l-.437-2.572a7.53 7.53 0 0 1-2.764-1.598l-2.302.776-1.875-3.248 1.94-1.51a7.62 7.62 0 0 1 0-3.196l-1.94-1.51 1.875-3.248 2.302.776a7.53 7.53 0 0 1 2.764-1.598L10.125 2.25h3.75l.437 2.572a7.53 7.53 0 0 1 2.764 1.598l2.302-.776 1.875 3.248-1.94 1.51c.122.513.187 1.048.187 1.598Z",
  orders:
    "M6 3.75h12v16.5l-3-1.5-3 1.5-3-1.5-3 1.5V3.75Zm3 4.5h6m-6 4.5h6",
  logout:
    "M15 12H3.75m0 0L7.5 8.25M3.75 12l3.75 3.75M9.75 4.5H18a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 18 19.5H9.75",
  menu: "M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h16.5",
  close: "M6 6l12 12M18 6 6 18",
  "chevron-right": "m8.25 4.5 7.5 7.5-7.5 7.5",
  inbox:
    "M3.75 13.5h4.5l1.5 2.25h4.5l1.5-2.25h4.5M3.75 13.5 6 5.25h12l2.25 8.25v5.25H3.75V13.5Z",
  file: "M7.5 3.75h6L18 8.25v12H7.5v-16.5Zm6 0v4.5H18",
  check: "m4.5 12.75 4.5 4.5 10.5-10.5",
};

export function Icon({
  name,
  className,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
