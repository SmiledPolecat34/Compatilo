import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';

export interface StoredFile {
  key: string; // nom de fichier généré, stocké en base (Track.fileKey)
  url: string; // chemin public servi par express.static
}

export interface StorageProvider {
  save(buffer: Buffer, originalName: string): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

export const UPLOAD_ROOT = path.resolve(process.cwd(), env.MUSIC_UPLOAD_DIR);

/**
 * Stockage sur disque local — suffisant pour démarrer. Sur Render, le
 * disque du plan gratuit est éphémère : pour la production, remplacer
 * cette implémentation par un provider S3/GCS respectant la même
 * interface (`save`/`remove`) sans toucher au reste du module musique.
 */
class LocalDiskStorage implements StorageProvider {
  async save(buffer: Buffer, originalName: string): Promise<StoredFile> {
    const ext = path.extname(originalName).toLowerCase() || '.mp3';
    const key = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    await mkdir(UPLOAD_ROOT, { recursive: true });
    await writeFile(path.join(UPLOAD_ROOT, key), buffer);
    return { key, url: `/uploads/audio/${key}` };
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(path.join(UPLOAD_ROOT, key));
    } catch {
      /* déjà supprimé */
    }
  }
}

export const storage: StorageProvider = new LocalDiskStorage();
