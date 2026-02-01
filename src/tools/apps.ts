import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../types.js";
import * as simctl from "../services/simctl.js";
import * as schemas from "../schemas/index.js";

type DeviceResolver = (identifier: string) => Promise<string>;

export function registerAppTools(
  server: McpServer,
  resolveDevice: DeviceResolver
): void {
  server.registerTool(
    "ios_install_app",
    {
      title: "Install App on Simulator",
      description: `Install an iOS app (.app bundle) on the simulator.

Args:
  - device: Device UDID, name, or 'booted'
  - app_path: Full path to the .app bundle

The app must be built for the simulator architecture.`,
      inputSchema: schemas.InstallAppSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.InstallAppSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        await simctl.installApp(udid, params.app_path);
        return { content: [{ type: "text", text: `App installed successfully.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_launch_app",
    {
      title: "Launch App on Simulator",
      description: `Launch an installed app on the simulator.

Args:
  - device: Device UDID, name, or 'booted'
  - bundle_id: App bundle identifier (e.g., 'com.example.MyApp')
  - arguments: Optional launch arguments`,
      inputSchema: schemas.LaunchAppSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.LaunchAppSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        const pid = await simctl.launchApp(udid, params.bundle_id, params.arguments);
        return { content: [{ type: "text", text: `App launched (PID: ${pid}).` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_terminate_app",
    {
      title: "Terminate App on Simulator",
      description: `Terminate a running app on the simulator.

Args:
  - device: Device UDID, name, or 'booted'
  - bundle_id: App bundle identifier`,
      inputSchema: schemas.TerminateAppSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.TerminateAppSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        await simctl.terminateApp(udid, params.bundle_id);
        return { content: [{ type: "text", text: `App terminated.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_list_apps",
    {
      title: "List Installed Apps",
      description: `List all apps installed on the simulator.

Args:
  - device: Device UDID, name, or 'booted'
  - response_format: 'markdown' or 'json'`,
      inputSchema: schemas.ListAppsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: z.infer<typeof schemas.ListAppsSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        const apps = await simctl.listApps(udid);

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(apps, null, 2)
            : apps.map((a) => `- **${a.name}** (\`${a.bundleId}\`)`).join("\n");

        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_open_url",
    {
      title: "Open URL in Simulator",
      description: `Open a URL in the simulator (launches default handler).

Args:
  - device: Device UDID, name, or 'booted'  
  - url: URL to open (http://, https://, or custom scheme)`,
      inputSchema: z.object({
        device: schemas.DeviceIdentifierSchema,
        url: z.string().describe("URL to open"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: { device: string; url: string }) => {
      try {
        const udid = await resolveDevice(params.device);
        await simctl.openUrl(udid, params.url);
        return { content: [{ type: "text", text: `Opened URL: ${params.url}` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_get_app_container",
    {
      title: "Get App Container Path",
      description: `Get the filesystem path to an app's container.

Args:
  - device: Device UDID, name, or 'booted'
  - bundle_id: App bundle identifier
  - container_type: 'app', 'data', or 'groups' (default: 'data')`,
      inputSchema: z.object({
        device: schemas.DeviceIdentifierSchema,
        bundle_id: z.string().describe("App bundle identifier"),
        container_type: z.enum(["app", "data", "groups"]).default("data"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { device: string; bundle_id: string; container_type: "app" | "data" | "groups" }) => {
      try {
        const udid = await resolveDevice(params.device);
        const path = await simctl.getAppContainer(udid, params.bundle_id, params.container_type);
        return { content: [{ type: "text", text: `Container path: ${path}` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
