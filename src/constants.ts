// Constants for iOS Simulator MCP Server

export const DEBUG_SERVER_PORT = 8765;
export const DEBUG_SERVER_HOST = "localhost";

export const SIMCTL_TIMEOUT_MS = 30000;
export const IDB_TIMEOUT_MS = 30000;

export const MIN_TOUCH_TARGET_SIZE = 44; // Apple HIG minimum

export const WCAG_AA_CONTRAST_NORMAL = 4.5;
export const WCAG_AA_CONTRAST_LARGE = 3.0;
export const WCAG_AAA_CONTRAST_NORMAL = 7.0;
export const WCAG_AAA_CONTRAST_LARGE = 4.5;

export const CHARACTER_LIMIT = 50000;

export const DEFAULT_SCREENSHOT_PATH = "/tmp/ios_simulator_screenshot.png";

export const SUPPORTED_ARCHITECTURES = ["arm64", "x86_64"] as const;

export const LOG_LEVELS = ["debug", "info", "warning", "error", "fault"] as const;
