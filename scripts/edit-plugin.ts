import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { normalizePath, type Plugin } from "vite";
import { DATA_DIR } from "./load-data";
import { saveMapFile } from "./save-map";

const ROUTE = /^\/__edit\/maps\/([a-z0-9]+)$/;
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export interface RequestInfo {
  remoteAddress?: string;
  origin?: string;
  host?: string;
  contentType?: string;
}

/** Spec §4 step 1: only this machine, only the dev site's own pages, only JSON. */
export function requestProblem({
  remoteAddress,
  origin,
  host,
  contentType,
}: RequestInfo): { status: 403 | 415; error: string } | null {
  if (remoteAddress === undefined || !LOOPBACK.has(remoteAddress)) {
    return { status: 403, error: "not-local" };
  }
  if (origin !== undefined && !sameHost(origin, host))
    return { status: 403, error: "foreign-origin" };
  if (!contentType?.toLowerCase().startsWith("application/json")) {
    return { status: 415, error: "json-only" };
  }
  return null;
}

function sameHost(origin: string, host: string | undefined): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Remembers what the editor wrote, so its own writes don't reload the page (spec §3.3). */
export function createWriteTracker() {
  const written = new Map<string, string>();
  const key = (path: string) => normalizePath(resolve(path));
  return {
    remember(path: string, text: string): void {
      written.set(key(path), text);
    },
    async isOwnWrite(path: string, read: () => string | Promise<string>): Promise<boolean> {
      const text = written.get(key(path));
      return text !== undefined && (await read()) === text;
    },
  };
}

type Next = (error?: unknown) => void;

export function createEditMiddleware({
  dataDir,
  onWritten,
}: {
  dataDir: string;
  onWritten: (path: string, text: string) => void;
}) {
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    const match = ROUTE.exec((req.url ?? "").split("?")[0]);
    if (req.method !== "PUT" || !match) return next();
    handleSave(req, res, match[1], dataDir, onWritten).catch(next);
  };
}

async function handleSave(
  req: IncomingMessage,
  res: ServerResponse,
  mapId: string,
  dataDir: string,
  onWritten: (path: string, text: string) => void,
): Promise<void> {
  const problem = requestProblem({
    remoteAddress: req.socket.remoteAddress,
    origin: req.headers.origin,
    host: req.headers.host,
    contentType: req.headers["content-type"],
  });
  if (problem) return send(res, problem.status, { error: problem.error });

  let body: unknown;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, {
      errors: [{ path: "", message: "the request body is not valid JSON" }],
    });
  }
  if (typeof body !== "object" || body === null || !("base" in body) || !("file" in body)) {
    return send(res, 400, {
      errors: [{ path: "", message: "the request body must be { base, file }" }],
    });
  }

  const result = await saveMapFile({ dataDir, mapId, base: body.base, file: body.file });
  if (result.status === 200) {
    onWritten(join(dataDir, `${mapId}.json`), result.text);
    return send(res, 200, { file: result.file });
  }
  const { status, ...rest } = result;
  return send(res, status, rest);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/** Edit mode's dev-server side (spec §3–4). `apply: "serve"`: `vite build` never loads it. */
export function editPlugin(dataDir: string = DATA_DIR): Plugin {
  const tracker = createWriteTracker();
  return {
    name: "cs-smokes-edit",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(createEditMiddleware({ dataDir, onWritten: tracker.remember }));
    },
    async handleHotUpdate({ file, read, modules, timestamp, server }) {
      if (!(await tracker.isOwnWrite(file, read))) return;
      // The page already has this data (saveMap swapped it in), so send no update. But mark the
      // JSON module as hot-updated: a later re-import then carries a fresh ?t= instead of reusing
      // the browser's pre-save copy.
      for (const mod of modules)
        server.moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
      return [];
    },
  };
}
