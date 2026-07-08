import { exec, execFile } from "child_process";
import { constants } from "fs";
import { access } from "fs/promises";
import { promisify } from "util";
import { IDB_TIMEOUT_MS } from "../constants.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// IDB path: check IDB_PATH env var, then venv, then system PATH
const IDB_ENV_PATH = process.env.IDB_PATH;
const IDB_VENV_PATH = `${process.env.HOME}/.ios-simulator-mcp/venv/bin/idb`;

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveIdbPath(): Promise<string | null> {
  if (IDB_ENV_PATH && await isExecutable(IDB_ENV_PATH)) {
    return IDB_ENV_PATH;
  }

  if (await isExecutable(IDB_VENV_PATH)) {
    return IDB_VENV_PATH;
  }

  try {
    const { stdout } = await execAsync("command -v idb");
    const whichPath = stdout.trim();
    if (whichPath && await isExecutable(whichPath)) {
      return whichPath;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Check if IDB is installed
 */
export async function isIdbInstalled(): Promise<boolean> {
  return (await resolveIdbPath()) !== null;
}

/**
 * Run an IDB command
 */
async function runIdb(
  args: string[],
  timeout: number = IDB_TIMEOUT_MS
): Promise<string> {
  const idbPath = await resolveIdbPath();
  if (!idbPath) {
    throw new Error("IDB is not installed or not executable.");
  }

  const { stdout, stderr } = await execFileAsync(idbPath, args, { timeout });

  if (stderr && !stderr.includes("WARNING")) {
    console.error(`idb stderr: ${stderr}`);
  }

  return stdout;
}

/**
 * List connected targets (simulators and devices)
 */
export async function listTargets(): Promise<
  Array<{ udid: string; name: string; state: string; type: string }>
> {
  const output = await runIdb(["list-targets", "--json"]);
  return output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Connect to a simulator
 */
export async function connect(udid: string): Promise<void> {
  await runIdb(["connect", udid]);
}

/**
 * Disconnect from a simulator
 */
export async function disconnect(udid: string): Promise<void> {
  await runIdb(["disconnect", udid]);
}

/**
 * Tap at coordinates
 */
export async function tap(udid: string, x: number, y: number): Promise<void> {
  await runIdb(["ui", "tap", x.toString(), y.toString(), "--udid", udid]);
}

/**
 * Double tap at coordinates
 */
export async function doubleTap(
  udid: string,
  x: number,
  y: number
): Promise<void> {
  // IDB doesn't have native double-tap, so we do two quick taps
  await tap(udid, x, y);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await tap(udid, x, y);
}

/**
 * Long press at coordinates
 */
export async function longPress(
  udid: string,
  x: number,
  y: number,
  duration: number = 1.0
): Promise<void> {
  await runIdb([
    "ui",
    "tap",
    x.toString(),
    y.toString(),
    "--duration",
    duration.toString(),
    "--udid",
    udid,
  ]);
}

/**
 * Swipe gesture
 */
export async function swipe(
  udid: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  duration: number = 0.5
): Promise<void> {
  await runIdb([
    "ui",
    "swipe",
    fromX.toString(),
    fromY.toString(),
    toX.toString(),
    toY.toString(),
    "--duration",
    duration.toString(),
    "--udid",
    udid,
  ]);
}

/**
 * Type text
 */
export async function inputText(udid: string, text: string): Promise<void> {
  await runIdb(["ui", "text", `"${text.replace(/"/g, '\\"')}"`, "--udid", udid]);
}

/**
 * Press a button (home, lock, siri, etc.)
 */
export async function pressButton(
  udid: string,
  button: "HOME" | "LOCK" | "SIRI" | "APPLE_PAY"
): Promise<void> {
  await runIdb(["ui", "button", button, "--udid", udid]);
}

/**
 * Press a key
 */
export async function pressKey(
  udid: string,
  keycode: number,
  modifiers: Array<"SHIFT" | "CONTROL" | "OPTION" | "COMMAND"> = []
): Promise<void> {
  const args = ["ui", "key", keycode.toString(), "--udid", udid];
  for (const mod of modifiers) {
    args.push("--modifier", mod);
  }
  await runIdb(args);
}

/**
 * Key sequence (e.g., for keyboard shortcuts)
 */
export async function keySequence(
  udid: string,
  keys: number[]
): Promise<void> {
  await runIdb([
    "ui",
    "key-sequence",
    ...keys.map((k) => k.toString()),
    "--udid",
    udid,
  ]);
}

/**
 * Take a screenshot using IDB
 */
export async function screenshot(
  udid: string,
  outputPath: string
): Promise<void> {
  await runIdb(["screenshot", outputPath, "--udid", udid]);
}

/**
 * Record video
 */
export async function recordVideo(
  udid: string,
  outputPath: string
): Promise<{ stop: () => Promise<void> }> {
  const idbPath = await resolveIdbPath();
  if (!idbPath) {
    throw new Error("IDB is not installed or not executable.");
  }

  const child = execFile(idbPath, ["record-video", outputPath, "--udid", udid]);

  return {
    stop: async () => {
      child.kill("SIGINT");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
  };
}

/**
 * Focus on an accessibility element by ID
 */
export async function focusAccessibilityElement(
  udid: string,
  accessibilityId: string
): Promise<void> {
  await runIdb([
    "accessibility",
    "focus",
    "--id",
    accessibilityId,
    "--udid",
    udid,
  ]);
}

/**
 * Get accessibility info for point
 */
export async function accessibilityInfoAtPoint(
  udid: string,
  x: number,
  y: number
): Promise<{
  label?: string;
  identifier?: string;
  traits?: string[];
  frame?: { x: number; y: number; width: number; height: number };
}> {
  const output = await runIdb([
    "accessibility",
    "info-at-point",
    x.toString(),
    y.toString(),
    "--udid",
    udid,
    "--json",
  ]);
  return JSON.parse(output);
}

/**
 * Clear the keychain
 */
export async function clearKeychain(udid: string): Promise<void> {
  await runIdb(["clear-keychain", "--udid", udid]);
}

/**
 * Set hardware keyboard preference
 */
export async function setHardwareKeyboard(
  udid: string,
  enabled: boolean
): Promise<void> {
  await runIdb([
    "set",
    "hardware-keyboard",
    enabled ? "true" : "false",
    "--udid",
    udid,
  ]);
}

/**
 * Get current UI state from accessibility
 */
export async function describeUI(udid: string): Promise<string> {
  const output = await runIdb(["ui", "describe-all", "--udid", udid]);
  return output;
}

/**
 * Describe specific point
 */
export async function describePoint(
  udid: string,
  x: number,
  y: number
): Promise<string> {
  const output = await runIdb([
    "ui",
    "describe-point",
    x.toString(),
    y.toString(),
    "--udid",
    udid,
  ]);
  return output;
}

/**
 * Install an app via IDB
 */
export async function installApp(udid: string, appPath: string): Promise<void> {
  await runIdb(["install", appPath, "--udid", udid]);
}

/**
 * Uninstall an app via IDB
 */
export async function uninstallApp(
  udid: string,
  bundleId: string
): Promise<void> {
  await runIdb(["uninstall", bundleId, "--udid", udid]);
}

/**
 * Launch an app via IDB
 */
export async function launchApp(
  udid: string,
  bundleId: string,
  waitForDebugger: boolean = false
): Promise<void> {
  const args = ["launch", bundleId, "--udid", udid];
  if (waitForDebugger) {
    args.push("--wait-for-debugger");
  }
  await runIdb(args);
}

/**
 * Terminate an app via IDB
 */
export async function terminateApp(
  udid: string,
  bundleId: string
): Promise<void> {
  await runIdb(["terminate", bundleId, "--udid", udid]);
}

/**
 * List running apps
 */
export async function listRunningApps(
  udid: string
): Promise<Array<{ bundleId: string; name: string; pid: number }>> {
  const output = await runIdb(["list-apps", "--udid", udid, "--json"]);
  const apps = output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .filter((app: { process_state?: string }) => app.process_state === "Running");
  return apps.map((app: { bundle_id: string; name: string; pid: number }) => ({
    bundleId: app.bundle_id,
    name: app.name,
    pid: app.pid,
  }));
}

/**
 * Open a URL
 */
export async function openUrl(udid: string, url: string): Promise<void> {
  await runIdb(["open", url, "--udid", udid]);
}

/**
 * Approve permissions for an app
 */
export async function approvePermission(
  udid: string,
  bundleId: string,
  permission: "photos" | "camera" | "contacts" | "url" | "location" | "microphone" | "notifications"
): Promise<void> {
  await runIdb(["approve", permission, bundleId, "--udid", udid]);
}

/**
 * Revoke permissions for an app
 */
export async function revokePermission(
  udid: string,
  bundleId: string,
  permission: "photos" | "camera" | "contacts" | "url" | "location" | "microphone" | "notifications"
): Promise<void> {
  await runIdb(["revoke", permission, bundleId, "--udid", udid]);
}

/**
 * Add media files to simulator
 */
export async function addMedia(
  udid: string,
  filePaths: string[]
): Promise<void> {
  await runIdb(["add-media", ...filePaths, "--udid", udid]);
}

/**
 * Contact container (for debugging contacts)
 */
export async function contactsUpdate(
  udid: string,
  dbPath: string
): Promise<void> {
  await runIdb(["contacts-update", dbPath, "--udid", udid]);
}

/**
 * Pull a file from the app
 */
export async function pull(
  udid: string,
  bundleId: string,
  srcPath: string,
  destPath: string
): Promise<void> {
  await runIdb([
    "file",
    "pull",
    srcPath,
    destPath,
    "--bundle-id",
    bundleId,
    "--udid",
    udid,
  ]);
}

/**
 * Push a file to the app
 */
export async function push(
  udid: string,
  bundleId: string,
  srcPath: string,
  destPath: string
): Promise<void> {
  await runIdb([
    "file",
    "push",
    srcPath,
    destPath,
    "--bundle-id",
    bundleId,
    "--udid",
    udid,
  ]);
}

/**
 * List files in app container
 */
export async function listFiles(
  udid: string,
  bundleId: string,
  path: string = "/"
): Promise<string[]> {
  const output = await runIdb([
    "file",
    "ls",
    path,
    "--bundle-id",
    bundleId,
    "--udid",
    udid,
  ]);
  return output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.trim());
}

/**
 * Set locale for simulator
 */
export async function setLocale(
  udid: string,
  localeIdentifier: string
): Promise<void> {
  await runIdb(["set", "locale", localeIdentifier, "--udid", udid]);
}

/**
 * Set location
 */
export async function setLocation(
  udid: string,
  latitude: number,
  longitude: number
): Promise<void> {
  await runIdb([
    "set",
    "location",
    latitude.toString(),
    longitude.toString(),
    "--udid",
    udid,
  ]);
}

/**
 * Clear location override
 */
export async function clearLocation(udid: string): Promise<void> {
  await runIdb(["clear", "location", "--udid", udid]);
}
