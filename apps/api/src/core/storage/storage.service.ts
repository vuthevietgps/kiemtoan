import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';

export interface UploadedFileInfo {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredFile {
  fileName: string;
  storedName: string;
  mimeType: string;
  size: number;
}

/**
 * Lưu file trên ổ đĩa (bản demo). Sau này thay bằng object storage chuẩn S3
 * mà không phải sửa các module dùng nó.
 */
@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('UPLOAD_DIR', 'uploads'));
  }

  async save(file: UploadedFileInfo): Promise<StoredFile> {
    const now = new Date();
    const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const storedName = `${folder}/${randomUUID()}${extname(file.originalname)}`;
    await mkdir(join(this.root, folder), { recursive: true });
    await writeFile(join(this.root, storedName), file.buffer);
    return {
      // multer đọc tên file dạng latin1; đổi lại để giữ tiếng Việt
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      storedName,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  /** Đường dẫn tuyệt đối để trả file về (res.sendFile). */
  pathOf(storedName: string): string {
    const full = resolve(this.root, storedName);
    const location = relative(this.root, full);
    if (
      !location ||
      location.startsWith('..') ||
      isAbsolute(location) ||
      !existsSync(full)
    ) {
      throw new NotFoundException('Không tìm thấy file');
    }
    return full;
  }

  async remove(storedName: string): Promise<void> {
    const full = this.pathOf(storedName);
    await unlink(full);
  }
}
