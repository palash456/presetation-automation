"use client";

import { usePathname } from "next/navigation";

export default function RouteTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="shell-main-fade min-h-full">
      {children}
    </div>
  );
}
