import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fail, guard, handler, isResponse, ok, requireApiRole } from '@/lib/api';
import { recordAudit } from '@/lib/audit';

/**
 * Local image upload.
 *
 * Files land in public/uploads with a random name and an extension derived
 * from the *sniffed* content type, never from the client-supplied filename —
 * that stops a "photo.jpg.html" from being served as HTML on our own origin.
 *
 * For production at scale, point this at S3/R2 instead; the response contract
 * (a public URL) stays the same.
 */

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;

/** Magic-number signatures for the formats we accept. */
const SIGNATURES: Array<{ ext: string; mime: string; test: (bytes: Uint8Array) => boolean }> = [
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: 'png',
    mime: 'image/png',
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    ext: 'gif',
    mime: 'image/gif',
    test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  },
];

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'upload' });
  if (blocked) return blocked;

  const user = await requireApiRole('SALES');
  if (isResponse(user)) return user;

  const form = await request.formData().catch(() => null);
  if (!form) return fail('Expected a multipart form upload.', 400);

  const file = form.get('file');
  if (!(file instanceof File)) return fail('No file was uploaded.', 400, { code: 'NO_FILE' });

  if (file.size === 0) return fail('That file is empty.', 400);
  if (file.size > MAX_BYTES) {
    return fail(`Images must be ${MAX_BYTES / 1024 / 1024} MB or smaller.`, 413, {
      code: 'FILE_TOO_LARGE',
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const signature = SIGNATURES.find((entry) => entry.test(buffer));

  if (!signature) {
    return fail('Only JPEG, PNG, WebP and GIF images can be uploaded.', 415, {
      code: 'UNSUPPORTED_TYPE',
    });
  }

  // Random name — never trust the client's filename for a path.
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${signature.ext}`;
  const directory = path.join(process.cwd(), 'public', 'uploads');

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), buffer);

  const url = `/uploads/${name}`;

  await recordAudit({
    action: 'truck.image_added',
    actor: user,
    entity: 'Upload',
    summary: `Uploaded ${name} (${Math.round(file.size / 1024)} KB)`,
    metadata: { url, mime: signature.mime, bytes: file.size },
  });

  return ok({ url, mime: signature.mime, bytes: file.size });
});
