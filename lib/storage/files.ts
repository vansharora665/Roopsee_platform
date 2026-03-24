import path from "path";

function getStorageRoot() {
  return process.env.FILE_STORAGE_ROOT?.trim() || path.join(process.cwd(), "storage");
}

function resolveWithin(baseDir: string, segments: string[]) {
  const basePath = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDir, ...segments);
  const isWithinBase =
    resolvedPath === basePath || resolvedPath.startsWith(basePath + path.sep)

  if (isWithinBase === false) {
    throw new Error("Invalid file path");
  }

  return resolvedPath;
}

export function getUploadsReportsDir() {
  return path.join(getStorageRoot(), "uploads", "reports");
}

export function getGeneratedReportsDir() {
  return path.join(getStorageRoot(), "generated", "reports");
}

export function getUploadReportPath(slug: string[]) {
  return resolveWithin(getUploadsReportsDir(), slug);
}

export function getGeneratedReportPath(slug: string[]) {
  return resolveWithin(getGeneratedReportsDir(), slug);
}

export function getContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".pdf":
      return "application/pdf";
    case ".html":
      return "text/html; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    default:
      return "application/octet-stream";
  }
}
