export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail: any,
  ) {
    super(message);
  }
}
export async function api(path: string, options: RequestInit = {}) {
  const response = await fetch("/api/v1" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const d = data.detail ?? data.error ?? data.message;
    throw new APIError(
      response.status,
      typeof d === "string"
        ? d
        : JSON.stringify(d) || `Erreur ${response.status}`,
      data,
    );
  }
  return data;
}
export const post = (path: string, body: any) =>
  api(path, { method: "POST", body: JSON.stringify(body) });
export async function download(path: string, name: string, method = "GET") {
  const r = await fetch("/api/v1" + path, {
    method,
    credentials: "same-origin",
  });
  if (!r.ok) throw new Error(await r.text());
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob());
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
