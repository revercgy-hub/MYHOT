import { spawn } from "node:child_process";

export interface BoundedProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  timedOut: boolean;
  outputExceeded: boolean;
  spawnFailed: boolean;
}

/** Runs one child to close, killing it on deadline/output overflow before resolving. */
export function runBoundedProcess(
  command: string,
  args: string[],
  options: { input: Uint8Array; timeoutMs: number; maxOutputBytes: number; windowsHide?: boolean },
): Promise<BoundedProcessResult> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ["pipe", "pipe", "ignore"], windowsHide: options.windowsHide ?? true });
    } catch {
      resolve({ code: null, signal: null, stdout: Buffer.alloc(0), timedOut: false, outputExceeded: false, spawnFailed: true });
      return;
    }
    const chunks: Buffer[] = [];
    let outputBytes = 0;
    let timedOut = false;
    let outputExceeded = false;
    let spawnFailed = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > options.maxOutputBytes) {
        outputExceeded = true;
        child.kill("SIGKILL");
        return;
      }
      chunks.push(chunk);
    });
    child.stdin.on("error", () => { /* close reports the terminal state */ });
    child.on("error", () => { spawnFailed = true; });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout: Buffer.concat(chunks), timedOut, outputExceeded, spawnFailed });
    });
    child.stdin.end(options.input);
  });
}
