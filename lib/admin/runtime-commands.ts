import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export function assertAdminToken(request: Request) {
  const expected = process.env.ADMIN_BOOTSTRAP_TOKEN?.trim();
  const provided = request.headers.get("x-admin-token")?.trim();

  if (!expected) {
    throw new Error("ADMIN_BOOTSTRAP_TOKEN is not configured.");
  }

  if (provided !== expected) {
    const error = new Error("Unauthorized");
    error.name = "UnauthorizedError";
    throw error;
  }
}

export async function runProjectCommand(command: string, args: string[]) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 1024 * 1024 * 20
  });

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim()
  };
}
