import type { Readable } from "node:stream";

export interface StorageService {
  put(key: string, body: Buffer, mimeType: string): Promise<void>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
