import type { CompanyTemplate } from "@/components/template-system/company-types";
import {
  mapUploadMetadataToCompanyTemplate,
  type UploadMetadata,
} from "./map-intelligence-to-company-template";

function uploadApiBase(): string {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_PPT_UPLOAD_API_URL
      : undefined;
  const base = (raw && raw.trim()) || "http://localhost:3000";
  return base.replace(/\/$/, "");
}

type UploadSuccessBody = {
  success?: boolean;
  metadata?: UploadMetadata;
  error?: string;
  details?: string;
};

/**
 * POSTs the .pptx to the backend `/upload` route and maps `metadata.intelligence`
 * into a `CompanyTemplate` for the existing template UI.
 */
export async function uploadPptxAndBuildCompanyTemplate(
  file: File,
): Promise<CompanyTemplate> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${uploadApiBase()}/upload`, {
    method: "POST",
    body: fd,
  });

  let body: UploadSuccessBody = {};
  try {
    body = (await res.json()) as UploadSuccessBody;
  } catch {
    body = {};
  }

  if (!res.ok) {
    const msg =
      body.error ||
      body.details ||
      `Upload failed (${res.status} ${res.statusText})`;
    throw new Error(msg);
  }

  if (!body.success || !body.metadata) {
    throw new Error(body.error || "Unexpected response from upload service.");
  }

  return mapUploadMetadataToCompanyTemplate(body.metadata, file.name);
}
