import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../types.js";
import * as simctl from "../services/simctl.js";
import { formatDeviceListMarkdown, formatLogsMarkdown, truncateResponse } from "../services/formatters.js";
import * as schemas from "../schemas/index.js";

type DeviceResolver = (identifier: string) => Promise<string>;

export function registerSimulatorTools(
  server: McpServer,
  resolveDevice: DeviceResolver
): void {
  server.registerTool(
    "ios_list_devices",
    {
      title: "List iOS Simulators",
      description: `List all available iOS Simulators with their status.

Returns device names, UDIDs, states (Booted/Shutdown), and iOS versions.
Use this to find the UDID of a simulator to target with other commands.

Args:
  - response_format: 'markdown' (default) or 'json'
  - available_only: Only show devices with available runtimes (default: true)`,
      inputSchema: schemas.ListDevicesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.ListDevicesSchema>) => {
      try {
        const devices = await simctl.listDevices();
        const filtered = params.available_only
          ? devices.filter((d) => d.isAvailable)
          : devices;

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(filtered, null, 2)
            : formatDeviceListMarkdown(filtered);

        return { content: [{ type: "text", text: truncateResponse(text) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_boot_device",
    {
      title: "Boot iOS Simulator",
      description: `Boot an iOS Simulator by name or UDID.

Args:
  - device: Device UDID or name (e.g., 'iPhone 15 Pro')

Use ios_list_devices first to find available device names.`,
      inputSchema: schemas.BootDeviceSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.BootDeviceSchema>) => {
      try {
        const device = await simctl.getDevice(params.device);
        if (!device) {
          throw new Error(`Device not found: ${params.device}`);
        }
        if (device.state === "Booted") {
          return { content: [{ type: "text", text: `Device ${device.name} is already booted.` }] };
        }
        await simctl.bootDevice(device.udid);
        return { content: [{ type: "text", text: `Started booting ${device.name}. Simulator window should appear shortly.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_shutdown_device",
    {
      title: "Shutdown iOS Simulator",
      description: `Shutdown a running iOS Simulator.

Args:
  - device: Device UDID, name, or 'booted' for current simulator`,
      inputSchema: schemas.ShutdownDeviceSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.ShutdownDeviceSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        await simctl.shutdownDevice(udid);
        return { content: [{ type: "text", text: `Simulator shutdown initiated.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_screenshot",
    {
      title: "Take Screenshot",
      description: `Take a screenshot of the iOS Simulator.

Args:
  - device: Device UDID, name, or 'booted'

Returns the screenshot as a base64-encoded PNG image.`,
      inputSchema: schemas.ScreenshotSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.ScreenshotSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        const base64 = await simctl.takeScreenshotBase64(udid);
        return {
          content: [{ type: "image", data: base64, mimeType: "image/png" }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_set_location",
    {
      title: "Set Simulator Location",
      description: `Set the GPS location for the simulator.

Args:
  - device: Device UDID, name, or 'booted'
  - latitude: Latitude (-90 to 90)
  - longitude: Longitude (-180 to 180)`,
      inputSchema: schemas.SetLocationSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.SetLocationSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        await simctl.setLocation(udid, params.latitude, params.longitude);
        return {
          content: [{ type: "text", text: `Location set to (${params.latitude}, ${params.longitude})` }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_set_status_bar",
    {
      title: "Set Status Bar Overrides",
      description: `Override status bar display for screenshots/demos.

Args:
  - device: Device UDID, name, or 'booted'
  - time: Time string (e.g., "9:41")
  - battery_level: 0-100
  - battery_state: 'charging', 'charged', 'discharging'
  - wifi_bars: 0-3
  - cellular_bars: 0-4`,
      inputSchema: schemas.SetStatusBarSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.SetStatusBarSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        await simctl.setStatusBar(udid, {
          time: params.time,
          batteryLevel: params.battery_level,
          batteryState: params.battery_state,
          wifiBars: params.wifi_bars,
          cellularBars: params.cellular_bars,
        });
        return { content: [{ type: "text", text: `Status bar overrides applied.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_push_notification",
    {
      title: "Push Notification",
      description: `Send a push notification to the simulator.

Args:
  - device: Device UDID, name, or 'booted'
  - bundle_id: Target app bundle ID
  - title: Notification title
  - body: Notification body
  - payload: Custom APNS payload object`,
      inputSchema: schemas.PushNotificationSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.PushNotificationSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        const payload = {
          aps: {
            alert: {
              title: params.title,
              body: params.body,
            },
            sound: "default",
          },
          ...params.payload,
        };
        await simctl.pushNotification(udid, params.bundle_id, payload);
        return { content: [{ type: "text", text: `Notification sent.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_set_permission",
    {
      title: "Set App Permission",
      description: `Grant, revoke, or reset app permissions.

Args:
  - device: Device UDID, name, or 'booted'
  - bundle_id: App bundle identifier
  - service: Permission type (all, calendar, contacts, location, photos, microphone, camera)
  - action: 'grant', 'revoke', or 'reset'`,
      inputSchema: schemas.SetPermissionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.SetPermissionSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        await simctl.setPrivacyPermission(
          udid,
          params.bundle_id,
          params.service,
          params.action
        );
        return {
          content: [{ type: "text", text: `Permission ${params.action}ed for ${params.service}.` }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_get_logs",
    {
      title: "Get App Logs",
      description: `Get recent logs from the simulator.

Args:
  - device: Device UDID, name, or 'booted'
  - bundle_id: Filter by app bundle ID (optional)
  - limit: Max logs to return (default 100)
  - response_format: 'markdown' or 'json'`,
      inputSchema: schemas.GetLogsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.GetLogsSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        const logs = await simctl.getRecentLogs(udid, params.bundle_id, params.limit);

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(logs, null, 2)
            : formatLogsMarkdown(logs);

        return { content: [{ type: "text", text: truncateResponse(text) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
