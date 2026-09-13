const API_URL = 'https://quickuploads.co/api/upload';
const API_KEY: string | undefined = process.env.UPLOAD_API_KEY || undefined;

interface QuickUploadsResponse {
  success: boolean;
  url: string;
  direct_url: string;
  deletion_url: string | null;
  code: string;
}

export interface QuickUploadResult {
  url: string;
  deletionUrl: string | null;
}

export async function uploadToQuickUploads(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<QuickUploadResult> {
  const boundary = `----${Math.random().toString(36).slice(2)}`;
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const headerBuf = Buffer.from(header, 'latin1');
  const footerBuf = Buffer.from(footer, 'latin1');
  const bodyBuf = Buffer.concat([headerBuf, buffer, footerBuf]);

  const headers: Record<string, string> = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': bodyBuf.length.toString(),
  };
  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: bodyBuf,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`QuickUploads error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as QuickUploadsResponse;
  if (!data.success || !data.direct_url) {
    throw new Error('QuickUploads: upload failed or missing direct_url');
  }
  return { url: data.direct_url, deletionUrl: data.deletion_url || null };
}

export async function deleteFromQuickUploads(deletionUrl: string): Promise<void> {
  try {
    await fetch(deletionUrl, { signal: AbortSignal.timeout(5000), redirect: 'follow' });
  } catch {
    /* best effort */
  }
}
