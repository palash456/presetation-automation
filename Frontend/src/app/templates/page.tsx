import { Suspense } from "react";
import { TemplatesPageClient } from "@/components/template-system/templates-page-client";

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesPageClient />
    </Suspense>
  );
}
