import * as FileSystem from "expo-file-system/src/legacy";
import { Platform } from "react-native";

function getLogDir(): string {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}crash_logs/` : "";
}

function getCrashLogFile(): string {
  const dir = getLogDir();
  return dir ? `${dir}crash-log.txt` : "";
}

let initialized = false;
let writeQueue: Promise<void> = Promise.resolve();

type ErrorUtilsLike = {
  getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler?: (
    handler: (error: unknown, isFatal?: boolean) => void
  ) => void;
};

function getErrorUtils(): ErrorUtilsLike | undefined {
  return (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike })
    .ErrorUtils;
}

function stringifyValue(value: unknown): string {
  if (value instanceof Error) {
    return [
      `name: ${value.name}`,
      `message: ${value.message}`,
      value.stack ? `stack:\n${value.stack}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildLogEntry(source: string, payload: unknown, isFatal?: boolean) {
  const time = new Date().toISOString();

  return [
    "============================================================",
    `[${time}] ${source}${isFatal ? " (fatal)" : ""}`,
    `platform: ${Platform.OS}`,
    stringifyValue(payload),
    "",
  ].join("\n");
}

export function appendCrashLog(
  source: string,
  payload: unknown,
  isFatal?: boolean
) {
  const logFile = getCrashLogFile();
  if (!logFile) {
    // Skip if documentDirectory is not populated yet
    return;
  }
  const entry = buildLogEntry(source, payload, isFatal);

  writeQueue = writeQueue
    .then(async () => {
      const dir = getLogDir();
      if (!dir) return;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      const fileInfo = await FileSystem.getInfoAsync(logFile);
      const previous = fileInfo.exists
        ? await FileSystem.readAsStringAsync(logFile)
        : "";
      await FileSystem.writeAsStringAsync(logFile, `${previous}${entry}`);
    })
    .catch(() => {});
}

export async function getCrashLogText() {
  const logFile = getCrashLogFile();
  if (!logFile) return "";
  const info = await FileSystem.getInfoAsync(logFile);
  if (!info.exists) return "";
  return FileSystem.readAsStringAsync(logFile);
}

export async function clearCrashLog() {
  const logFile = getCrashLogFile();
  if (!logFile) return;
  await FileSystem.deleteAsync(logFile, { idempotent: true });
}

export function initCrashLogger() {
  if (initialized) return;
  initialized = true;

  const errorUtils = getErrorUtils();
  const previousHandler = errorUtils?.getGlobalHandler?.();

  errorUtils?.setGlobalHandler?.((error, isFatal) => {
    appendCrashLog("global-error", error, isFatal);
    previousHandler?.(error, isFatal);
  });

  // DO NOT intercept console.error to prevent infinite loops / call-stack overflow crashes
}
