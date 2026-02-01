import { z } from "zod";
import { ResponseFormat } from "../types.js";

// Common schemas
export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for structured data");

export const DeviceIdentifierSchema = z
  .string()
  .describe("Device UDID or name. Use 'booted' to target the currently running simulator.");

// Simulator management schemas
export const ListDevicesSchema = z.object({
  response_format: ResponseFormatSchema,
  available_only: z
    .boolean()
    .default(true)
    .describe("Only show available (downloadable runtimes installed) devices"),
}).strict();

export const BootDeviceSchema = z.object({
  device: DeviceIdentifierSchema,
}).strict();

export const ShutdownDeviceSchema = z.object({
  device: DeviceIdentifierSchema,
}).strict();

// App management schemas
export const InstallAppSchema = z.object({
  device: DeviceIdentifierSchema,
  app_path: z
    .string()
    .describe("Path to the .app bundle to install"),
}).strict();

export const LaunchAppSchema = z.object({
  device: DeviceIdentifierSchema,
  bundle_id: z
    .string()
    .describe("Bundle identifier of the app (e.g., 'com.example.MyApp')"),
  arguments: z
    .array(z.string())
    .default([])
    .describe("Launch arguments to pass to the app"),
}).strict();

export const TerminateAppSchema = z.object({
  device: DeviceIdentifierSchema,
  bundle_id: z.string().describe("Bundle identifier of the app"),
}).strict();

export const ListAppsSchema = z.object({
  device: DeviceIdentifierSchema,
  response_format: ResponseFormatSchema,
}).strict();

// Screenshot and recording schemas
export const ScreenshotSchema = z.object({
  device: DeviceIdentifierSchema,
}).strict();

// View hierarchy schemas
export const GetViewHierarchySchema = z.object({
  response_format: ResponseFormatSchema,
}).strict();

export const FindViewSchema = z.object({
  label: z
    .string()
    .optional()
    .describe("Accessibility label to search for"),
  identifier: z
    .string()
    .optional()
    .describe("Accessibility identifier to search for"),
}).strict().refine(
  (data) => data.label || data.identifier,
  "Either 'label' or 'identifier' must be provided"
);

export const GetConstraintsSchema = z.object({
  view_id: z
    .string()
    .describe("The view ID (from view hierarchy) to get constraints for"),
  response_format: ResponseFormatSchema,
}).strict();

// UI interaction schemas
export const TapSchema = z.object({
  device: DeviceIdentifierSchema,
  x: z.number().optional().describe("X coordinate"),
  y: z.number().optional().describe("Y coordinate"),
  label: z.string().optional().describe("Accessibility label to tap"),
}).strict().refine(
  (data) => (data.x !== undefined && data.y !== undefined) || data.label,
  "Either coordinates (x, y) or accessibility label must be provided"
);

export const SwipeSchema = z.object({
  device: DeviceIdentifierSchema,
  from_x: z.number().describe("Starting X coordinate"),
  from_y: z.number().describe("Starting Y coordinate"),
  to_x: z.number().describe("Ending X coordinate"),
  to_y: z.number().describe("Ending Y coordinate"),
  duration: z.number().default(0.5).describe("Duration in seconds"),
}).strict();

export const InputTextSchema = z.object({
  device: DeviceIdentifierSchema,
  text: z.string().describe("Text to input"),
}).strict();

// Audit schemas
export const TouchTargetAuditSchema = z.object({
  response_format: ResponseFormatSchema,
}).strict();

export const ContrastAuditSchema = z.object({
  response_format: ResponseFormatSchema,
}).strict();

export const LayoutAuditSchema = z.object({
  response_format: ResponseFormatSchema,
}).strict();

// Logging schemas
export const GetLogsSchema = z.object({
  device: DeviceIdentifierSchema,
  bundle_id: z.string().optional().describe("Filter logs by bundle ID"),
  limit: z.number().int().min(1).max(1000).default(100).describe("Maximum logs to return"),
  response_format: ResponseFormatSchema,
}).strict();

// Build and deploy schema
export const BuildAndRunSchema = z.object({
  project_path: z
    .string()
    .describe("Path to the Xcode project or workspace"),
  scheme: z
    .string()
    .describe("Build scheme name"),
  device: DeviceIdentifierSchema,
  configuration: z
    .enum(["Debug", "Release"])
    .default("Debug")
    .describe("Build configuration"),
}).strict();

// Location schemas
export const SetLocationSchema = z.object({
  device: DeviceIdentifierSchema,
  latitude: z.number().min(-90).max(90).describe("Latitude"),
  longitude: z.number().min(-180).max(180).describe("Longitude"),
}).strict();

// Debug server schemas
export const HighlightViewSchema = z.object({
  view_id: z.string().describe("View ID to highlight"),
  color: z.string().default("#FF0000").describe("Highlight color (hex)"),
  duration: z.number().default(2.0).describe("Duration in seconds"),
}).strict();

export const GetViewColorsSchema = z.object({
  view_id: z.string().describe("View ID to get colors for"),
}).strict();

export const GetFontInfoSchema = z.object({
  view_id: z.string().describe("View ID to get font info for"),
}).strict();

export const OverrideTraitsSchema = z.object({
  user_interface_style: z
    .enum(["light", "dark", "unspecified"])
    .optional()
    .describe("Override appearance mode"),
  content_size_category: z
    .string()
    .optional()
    .describe("Override Dynamic Type size (e.g., 'UICTContentSizeCategoryAccessibilityExtraExtraExtraLarge')"),
}).strict();

// Export view schema
export const ExportViewImageSchema = z.object({
  view_id: z.string().describe("View ID to export as image"),
}).strict();

// Push notification schema
export const PushNotificationSchema = z.object({
  device: DeviceIdentifierSchema,
  bundle_id: z.string().describe("Target app bundle ID"),
  title: z.string().optional().describe("Notification title"),
  body: z.string().optional().describe("Notification body"),
  payload: z.record(z.unknown()).optional().describe("Custom APNS payload"),
}).strict();

// Status bar schema
export const SetStatusBarSchema = z.object({
  device: DeviceIdentifierSchema,
  time: z.string().optional().describe("Override time display"),
  battery_level: z.number().min(0).max(100).optional().describe("Battery level 0-100"),
  battery_state: z.enum(["charging", "charged", "discharging"]).optional(),
  wifi_bars: z.number().min(0).max(3).optional(),
  cellular_bars: z.number().min(0).max(4).optional(),
}).strict();

// Privacy permission schema
export const SetPermissionSchema = z.object({
  device: DeviceIdentifierSchema,
  bundle_id: z.string().describe("App bundle ID"),
  service: z.enum([
    "all",
    "calendar",
    "contacts",
    "location",
    "location-always",
    "photos",
    "microphone",
    "camera",
  ]).describe("Permission service"),
  action: z.enum(["grant", "revoke", "reset"]).describe("Action to take"),
}).strict();

// Memory and performance schemas
export const GetMemoryStatsSchema = z.object({}).strict();

export const GetRenderMetricsSchema = z.object({}).strict();

export const SimulateMemoryWarningSchema = z.object({}).strict();

// Responder chain schema
export const GetResponderChainSchema = z.object({
  response_format: ResponseFormatSchema,
}).strict();

// Interactive elements schema
export const GetInteractiveElementsSchema = z.object({
  response_format: ResponseFormatSchema,
}).strict();

// File operations schemas
export const PullFileSchema = z.object({
  device: DeviceIdentifierSchema,
  bundle_id: z.string().describe("App bundle ID"),
  source_path: z.string().describe("Path within app container"),
  destination_path: z.string().describe("Local destination path"),
}).strict();

export const PushFileSchema = z.object({
  device: DeviceIdentifierSchema,
  bundle_id: z.string().describe("App bundle ID"),
  source_path: z.string().describe("Local source path"),
  destination_path: z.string().describe("Path within app container"),
}).strict();

export const ListAppFilesSchema = z.object({
  device: DeviceIdentifierSchema,
  bundle_id: z.string().describe("App bundle ID"),
  path: z.string().default("/").describe("Directory path within app container"),
}).strict();

// User defaults schema
export const SetUserDefaultSchema = z.object({
  key: z.string().describe("User defaults key"),
  value: z.unknown().describe("Value to set"),
}).strict();

export const GetUserDefaultSchema = z.object({
  key: z.string().describe("User defaults key"),
}).strict();
