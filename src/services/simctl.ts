import { exec, spawn } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import {
  SimulatorDevice,
  DeviceList,
  AppLog,
} from "../types.js";
import {
  SIMCTL_TIMEOUT_MS,
  DEFAULT_SCREENSHOT_PATH,
} from "../constants.js";

const execAsync = promisify(exec);

/**
 * Execute a simctl command with timeout
 */
async function runSimctl(
  args: string[],
  timeout: number = SIMCTL_TIMEOUT_MS
): Promise<string> {
  const { stdout, stderr } = await execAsync(`xcrun simctl ${args.join(" ")}`, {
    timeout,
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
  });

  if (stderr && !stderr.includes("Warning")) {
    console.error(`simctl stderr: ${stderr}`);
  }

  return stdout;
}

/**
 * List all available simulators
 */
export async function listDevices(): Promise<SimulatorDevice[]> {
  const output = await runSimctl(["list", "devices", "--json"]);
  const data: DeviceList = JSON.parse(output);

  const devices: SimulatorDevice[] = [];
  for (const [runtime, runtimeDevices] of Object.entries(data.devices)) {
    for (const device of runtimeDevices) {
      devices.push({
        ...device,
        runtime: runtime.replace("com.apple.CoreSimulator.SimRuntime.", ""),
      });
    }
  }

  return devices;
}

/**
 * Get a specific device by UDID or name
 */
export async function getDevice(
  identifier: string
): Promise<SimulatorDevice | undefined> {
  const devices = await listDevices();
  return devices.find(
    (d) =>
      d.udid === identifier ||
      d.name.toLowerCase() === identifier.toLowerCase()
  );
}

/**
 * Get the currently booted device
 */
export async function getBootedDevice(): Promise<SimulatorDevice | undefined> {
  const devices = await listDevices();
  return devices.find((d) => d.state === "Booted");
}

/**
 * Boot a simulator
 */
export async function bootDevice(udid: string): Promise<void> {
  await runSimctl(["boot", udid]);
  // Wait a moment for boot to complete
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * Shutdown a simulator
 */
export async function shutdownDevice(udid: string): Promise<void> {
  await runSimctl(["shutdown", udid]);
}

/**
 * Install an app on the simulator
 */
export async function installApp(udid: string, appPath: string): Promise<void> {
  await runSimctl(["install", udid, appPath]);
}

/**
 * Uninstall an app from the simulator
 */
export async function uninstallApp(
  udid: string,
  bundleId: string
): Promise<void> {
  await runSimctl(["uninstall", udid, bundleId]);
}

/**
 * Launch an app on the simulator
 */
export async function launchApp(
  udid: string,
  bundleId: string,
  args: string[] = []
): Promise<number> {
  const output = await runSimctl([
    "launch",
    "--console-pty",
    udid,
    bundleId,
    ...args,
  ]);
  // Extract PID from output like "com.example.app: 12345"
  const match = output.match(/:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Terminate an app on the simulator
 */
export async function terminateApp(
  udid: string,
  bundleId: string
): Promise<void> {
  await runSimctl(["terminate", udid, bundleId]);
}

/**
 * Take a screenshot of the simulator
 */
export async function takeScreenshot(
  udid: string,
  outputPath: string = DEFAULT_SCREENSHOT_PATH
): Promise<string> {
  await runSimctl(["io", udid, "screenshot", outputPath]);
  return outputPath;
}

/**
 * Take a screenshot and return as base64
 */
export async function takeScreenshotBase64(udid: string): Promise<string> {
  const path = `/tmp/screenshot_${Date.now()}.png`;
  await takeScreenshot(udid, path);
  const buffer = await fs.readFile(path);
  await fs.unlink(path); // Clean up
  return buffer.toString("base64");
}

/**
 * Get the UI hierarchy using accessibility
 */
export async function getAccessibilityHierarchy(udid: string): Promise<string> {
  // This returns XML accessibility tree
  const output = await runSimctl(["ui", udid, "describe"]);
  return output;
}

/**
 * Open a URL in the simulator
 */
export async function openUrl(udid: string, url: string): Promise<void> {
  await runSimctl(["openurl", udid, url]);
}

/**
 * Add media to the simulator (photos/videos)
 */
export async function addMedia(udid: string, mediaPath: string): Promise<void> {
  await runSimctl(["addmedia", udid, mediaPath]);
}

/**
 * Set the simulator location
 */
export async function setLocation(
  udid: string,
  latitude: number,
  longitude: number
): Promise<void> {
  await runSimctl([
    "location",
    udid,
    "set",
    latitude.toString(),
    longitude.toString(),
  ]);
}

/**
 * Clear the simulator location
 */
export async function clearLocation(udid: string): Promise<void> {
  await runSimctl(["location", udid, "clear"]);
}

/**
 * Get app container path
 */
export async function getAppContainer(
  udid: string,
  bundleId: string,
  containerType: "app" | "data" | "groups" = "app"
): Promise<string> {
  const output = await runSimctl([
    "get_app_container",
    udid,
    bundleId,
    containerType,
  ]);
  return output.trim();
}

/**
 * Stream logs from the simulator
 */
export function streamLogs(
  udid: string,
  predicate?: string,
  callback?: (log: AppLog) => void
): { stop: () => void } {
  const args = ["spawn", udid, "log", "stream", "--style", "json"];

  if (predicate) {
    args.push("--predicate", predicate);
  }

  const child = spawn("xcrun", ["simctl", ...args]);

  let buffer = "";

  child.stdout.on("data", (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        try {
          const logEntry = JSON.parse(line);
          const appLog: AppLog = {
            timestamp: logEntry.timestamp || new Date().toISOString(),
            level: logEntry.messageType?.toLowerCase() || "info",
            subsystem: logEntry.subsystem,
            category: logEntry.category,
            message: logEntry.eventMessage || logEntry.message || "",
          };
          callback?.(appLog);
        } catch {
          // Skip malformed JSON
        }
      }
    }
  });

  child.stderr.on("data", (data: Buffer) => {
    console.error(`Log stream error: ${data}`);
  });

  return {
    stop: () => {
      child.kill();
    },
  };
}

/**
 * Get recent logs (non-streaming)
 */
export async function getRecentLogs(
  udid: string,
  bundleId?: string,
  limit: number = 100
): Promise<AppLog[]> {
  const args = ["spawn", udid, "log", "show", "--style", "json", "--last", "5m"];

  if (bundleId) {
    args.push("--predicate", `subsystem == "${bundleId}"`);
  }

  const { stdout } = await execAsync(`xcrun simctl ${args.join(" ")}`, {
    timeout: SIMCTL_TIMEOUT_MS,
    maxBuffer: 50 * 1024 * 1024,
  });

  const logs: AppLog[] = [];
  const lines = stdout.split("\n");

  for (const line of lines) {
    if (line.trim() && logs.length < limit) {
      try {
        const logEntry = JSON.parse(line);
        logs.push({
          timestamp: logEntry.timestamp || "",
          level: logEntry.messageType?.toLowerCase() || "info",
          subsystem: logEntry.subsystem,
          category: logEntry.category,
          message: logEntry.eventMessage || logEntry.message || "",
        });
      } catch {
        // Skip malformed JSON
      }
    }
  }

  return logs;
}

/**
 * Push a notification to the simulator
 */
export async function pushNotification(
  udid: string,
  bundleId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const payloadPath = `/tmp/notification_${Date.now()}.json`;
  await fs.writeFile(payloadPath, JSON.stringify(payload));
  await runSimctl(["push", udid, bundleId, payloadPath]);
  await fs.unlink(payloadPath);
}

/**
 * Set the status bar overrides
 */
export async function setStatusBar(
  udid: string,
  overrides: {
    time?: string;
    dataNetwork?: string;
    wifiMode?: string;
    wifiBars?: number;
    cellularMode?: string;
    cellularBars?: number;
    batteryState?: string;
    batteryLevel?: number;
  }
): Promise<void> {
  const args = ["status_bar", udid, "override"];

  if (overrides.time) args.push("--time", overrides.time);
  if (overrides.dataNetwork) args.push("--dataNetwork", overrides.dataNetwork);
  if (overrides.wifiMode) args.push("--wifiMode", overrides.wifiMode);
  if (overrides.wifiBars !== undefined)
    args.push("--wifiBars", overrides.wifiBars.toString());
  if (overrides.cellularMode)
    args.push("--cellularMode", overrides.cellularMode);
  if (overrides.cellularBars !== undefined)
    args.push("--cellularBars", overrides.cellularBars.toString());
  if (overrides.batteryState)
    args.push("--batteryState", overrides.batteryState);
  if (overrides.batteryLevel !== undefined)
    args.push("--batteryLevel", overrides.batteryLevel.toString());

  await runSimctl(args);
}

/**
 * Clear status bar overrides
 */
export async function clearStatusBar(udid: string): Promise<void> {
  await runSimctl(["status_bar", udid, "clear"]);
}

/**
 * Erase all content and settings
 */
export async function eraseDevice(udid: string): Promise<void> {
  await runSimctl(["erase", udid]);
}

/**
 * Get list of installed apps
 */
export async function listApps(
  udid: string
): Promise<Array<{ bundleId: string; name: string; path: string }>> {
  const output = await runSimctl(["listapps", udid, "--json"]);
  const data = JSON.parse(output);

  return Object.entries(data).map(([bundleId, info]: [string, unknown]) => {
    const appInfo = info as { CFBundleDisplayName?: string; Path?: string };
    return {
      bundleId,
      name: appInfo.CFBundleDisplayName || bundleId,
      path: appInfo.Path || "",
    };
  });
}

/**
 * Record video from simulator
 */
export function startRecording(
  udid: string,
  outputPath: string
): { stop: () => Promise<void> } {
  const child = spawn("xcrun", [
    "simctl",
    "io",
    udid,
    "recordVideo",
    outputPath,
  ]);

  return {
    stop: async () => {
      child.kill("SIGINT");
      // Wait for file to be finalized
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
  };
}

/**
 * Input text into the simulator
 */
export async function inputText(udid: string, text: string): Promise<void> {
  // simctl doesn't have direct text input, but we can use pbcopy + paste
  // or use AppleScript through the Simulator app
  const escapedText = text.replace(/"/g, '\\"');
  await execAsync(
    `osascript -e 'tell application "Simulator" to activate' -e 'tell application "System Events" to keystroke "${escapedText}"'`
  );
}

/**
 * Privacy permission grant/revoke
 */
export async function setPrivacyPermission(
  udid: string,
  bundleId: string,
  service:
    | "all"
    | "calendar"
    | "contacts"
    | "location"
    | "location-always"
    | "photos"
    | "microphone"
    | "camera",
  action: "grant" | "revoke" | "reset"
): Promise<void> {
  await runSimctl(["privacy", udid, action, service, bundleId]);
}
