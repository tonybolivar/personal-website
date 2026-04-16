import { Dropbox, type files } from "dropbox";
import nodeFetch from "node-fetch";

interface SyncFile {
  name: string;
  path: string;
  size: number;
  bytes: Uint8Array;
}

let cached: Dropbox | null = null;

function client(): Dropbox {
  if (cached) return cached;
  const clientId = process.env.DROPBOX_APP_KEY;
  const clientSecret = process.env.DROPBOX_APP_SECRET;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Dropbox env missing: DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN");
  }
  cached = new Dropbox({
    clientId,
    clientSecret,
    refreshToken,
    // Dropbox SDK 10.x calls res.buffer(), which only exists on node-fetch v2.
    fetch: nodeFetch as unknown as typeof fetch,
  });
  return cached;
}

async function listFolderAll(path: string): Promise<files.FileMetadataReference[]> {
  const dbx = client();
  const out: files.FileMetadataReference[] = [];
  let res = await dbx.filesListFolder({ path, recursive: false });
  for (;;) {
    for (const entry of res.result.entries) {
      if (entry[".tag"] === "file") out.push(entry as files.FileMetadataReference);
    }
    if (!res.result.has_more) break;
    res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
  }
  return out;
}

export async function fetchSyncFiles(): Promise<SyncFile[]> {
  const syncPath = process.env.DROPBOX_SYNC_PATH;
  if (!syncPath) throw new Error("DROPBOX_SYNC_PATH is required (e.g. 'ns:14083822995//Sync')");
  const dbx = client();
  const entries = await listFolderAll(syncPath);
  // Download all in parallel, but with a modest cap to stay polite to Dropbox.
  const concurrency = 8;
  const out: SyncFile[] = new Array(entries.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= entries.length) return;
      const e = entries[i];
      const dl = await dbx.filesDownload({ path: e.path_lower ?? e.id });
      // Node runtime: dropbox SDK attaches the binary as `fileBinary` (Buffer).
      const fileBinary = (dl.result as unknown as { fileBinary: Buffer }).fileBinary;
      out[i] = {
        name: e.name,
        path: e.path_lower ?? e.path_display ?? e.id,
        size: e.size,
        bytes: new Uint8Array(fileBinary.buffer, fileBinary.byteOffset, fileBinary.byteLength),
      };
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}
