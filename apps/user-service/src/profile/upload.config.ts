import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

/** Uploads live next to the built app so they survive `nest build` output changes. */
export const UPLOAD_DIR = join(process.cwd(), 'uploads');

/** Public path, relative to the `/v1` API root, that static uploads are served from. */
export const UPLOAD_URL_PREFIX = '/users/uploads';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export const imageUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadDir();
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, WebP or GIF images are allowed'), false);
      return;
    }
    cb(null, true);
  },
};
