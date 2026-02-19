import type { ApiError, ApiResponse } from "./types";

export async function analyzeReport(file: File): Promise<ApiResponse> {
  const BASE = import.meta.env.VITE_API_BASE_URL || "";

  const form = new FormData();
  form.append("file", file); // must match multer upload.single("file")

  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    body: form,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    if (isJson) {
      const errorData = (await res.json()) as ApiError;
      throw new Error(
        errorData.details
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error
      );
    } else {
      const text = await res.text();
      throw new Error(text || "Upload failed");
    }
  }

  return (await res.json()) as ApiResponse;
}
