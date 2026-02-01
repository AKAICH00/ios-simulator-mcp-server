import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { ResponseFormat } from "./types.js";
import * as simctl from "./services/simctl.js";
import * as idb from "./services/idb.js";
import { debugClient } from "./services/debugServer.js";
import {
  truncateResponse,
  formatViewHierarchyMarkdown,
  formatDeviceListMarkdown,
  formatTouchTargetAuditMarkdown,
  formatContrastAuditMarkdown,
  formatLogsMarkdown,
  formatConstraintsMarkdown,
} from "./services/formatters.js";
import * as schemas from "./schemas/index.js";

// Initialize MCP server
const server = new McpServer({
  name: "ios-simulator-mcp-server",
  version: "1.0.0",
});

// Helper to resolve device identifier
async function resolveDevice(identifier: string): Promise<string> {
  if (identifier.toLowerCase() === "booted") {
    const booted = await simctl.getBootedDevice();
    if (!booted) {
      throw new Error("No simulator is currently booted");
    }
    return booted.udid;
  }
  const device = await simctl.getDevice(identifier);
  if (!device) {
    throw new Error(`Device not found: ${identifier}`);
  }
  return device.udid;
}

// Register all tools
import { registerSimulatorTools } from "./tools/simulator.js";
import { registerAppTools } from "./tools/apps.js";
import { registerUITools } from "./tools/ui.js";
import { registerDebugTools } from "./tools/debug.js";
import { registerAuditTools } from "./tools/audit.js";

registerSimulatorTools(server, resolveDevice);
registerAppTools(server, resolveDevice);
registerUITools(server, resolveDevice);
registerDebugTools(server);
registerAuditTools(server);

// Run the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("iOS Simulator MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
