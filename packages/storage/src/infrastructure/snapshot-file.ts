import { randomUUID } from "node:crypto";
import { mkdir, readFile, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import type { Conversation } from "@bazak/shared";
import { SnapshotSchema, type Snapshot } from "../domain/snapshot.js";
import { StorageError } from "../domain/storage-error.js";

export class SnapshotFile {
  constructor(private readonly path: string) {}

  async read(): Promise<Snapshot | undefined> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new StorageError(
        "Unable to read conversation storage. Existing data has not been changed.",
        "CORRUPT",
        { cause: error },
      );
    }
    try {
      return SnapshotSchema.parse(JSON.parse(raw));
    } catch (error) {
      throw new StorageError(
        "Conversation storage is corrupted or has an invalid schema. Preserve the file and restore a backup before restarting.",
        "CORRUPT",
        { cause: error },
      );
    }
  }

  async write(records: Map<string, Conversation>): Promise<void> {
    const temporaryPath = `${this.path}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      const file = await open(temporaryPath, "wx", 0o600);
      try {
        await file.writeFile(
          JSON.stringify({ version: 1, conversations: [...records.values()] }),
        );
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporaryPath, this.path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw new StorageError(
        "Unable to save conversation. Check disk space and permissions; the previous snapshot is unchanged.",
        "WRITE_FAILED",
        { cause: error },
      );
    }
  }
}
