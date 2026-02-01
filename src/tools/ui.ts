import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as idb from "../services/idb.js";
import { debugClient } from "../services/debugServer.js";
import * as schemas from "../schemas/index.js";

type DeviceResolver = (identifier: string) => Promise<string>;

export function registerUITools(
  server: McpServer,
  resolveDevice: DeviceResolver
): void {
  server.registerTool(
    "ios_tap",
    {
      title: "Tap on Simulator",
      description: `Tap at coordinates or on an element by accessibility label.

**For label-based tapping:** Requires ClaudeDebugKit in the app.
**For coordinate tapping:** Requires IDB (fb-idb) installed.

Args:
  - device: Device UDID, name, or 'booted'
  - x, y: Coordinates to tap (optional)
  - label: Accessibility label to tap (optional)

Either coordinates OR label must be provided.`,
      inputSchema: schemas.TapSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.TapSchema>) => {
      try {
        if (params.label) {
          const response = await debugClient.tapByLabel(params.label);
          if (!response.success) {
            throw new Error(response.error);
          }
          return { content: [{ type: "text", text: `Tapped on "${params.label}".` }] };
        } else if (params.x !== undefined && params.y !== undefined) {
          const udid = await resolveDevice(params.device);
          const hasIdb = await idb.isIdbInstalled();
          if (!hasIdb) {
            throw new Error("IDB not installed. Install with: brew install idb-companion && pip install fb-idb");
          }
          await idb.tap(udid, params.x, params.y);
          return { content: [{ type: "text", text: `Tapped at (${params.x}, ${params.y}).` }] };
        }
        throw new Error("Either coordinates or label must be provided");
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_swipe",
    {
      title: "Swipe on Simulator",
      description: `Perform a swipe gesture on the simulator.

**REQUIRES:** IDB (fb-idb) must be installed.

Args:
  - device: Device UDID, name, or 'booted'
  - from_x, from_y: Starting coordinates
  - to_x, to_y: Ending coordinates
  - duration: Swipe duration in seconds (default 0.5)`,
      inputSchema: schemas.SwipeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.SwipeSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        const hasIdb = await idb.isIdbInstalled();
        if (!hasIdb) {
          throw new Error("IDB not installed. Install with: brew install idb-companion && pip install fb-idb");
        }
        await idb.swipe(udid, params.from_x, params.from_y, params.to_x, params.to_y, params.duration);
        return {
          content: [{ type: "text", text: `Swiped from (${params.from_x}, ${params.from_y}) to (${params.to_x}, ${params.to_y}).` }],
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
    "ios_input_text",
    {
      title: "Input Text",
      description: `Type text into the simulator.

**REQUIRES:** IDB (fb-idb) must be installed.

Args:
  - device: Device UDID, name, or 'booted'
  - text: Text to type`,
      inputSchema: schemas.InputTextSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.InputTextSchema>) => {
      try {
        const udid = await resolveDevice(params.device);
        const hasIdb = await idb.isIdbInstalled();
        if (hasIdb) {
          await idb.inputText(udid, params.text);
        } else {
          // Fallback to simctl method (less reliable)
          await import("../services/simctl.js").then((s) => s.inputText(udid, params.text));
        }
        return { content: [{ type: "text", text: `Typed: "${params.text}"` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_press_button",
    {
      title: "Press Hardware Button",
      description: `Press a hardware button on the simulator.

**REQUIRES:** IDB (fb-idb) must be installed.

Args:
  - device: Device UDID, name, or 'booted'
  - button: 'HOME', 'LOCK', 'SIRI', or 'APPLE_PAY'`,
      inputSchema: z.object({
        device: schemas.DeviceIdentifierSchema,
        button: z.enum(["HOME", "LOCK", "SIRI", "APPLE_PAY"]).describe("Hardware button to press"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: { device: string; button: "HOME" | "LOCK" | "SIRI" | "APPLE_PAY" }) => {
      try {
        const udid = await resolveDevice(params.device);
        const hasIdb = await idb.isIdbInstalled();
        if (!hasIdb) {
          throw new Error("IDB not installed. Install with: brew install idb-companion && pip install fb-idb");
        }
        await idb.pressButton(udid, params.button);
        return { content: [{ type: "text", text: `Pressed ${params.button} button.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_long_press",
    {
      title: "Long Press",
      description: `Perform a long press at coordinates.

**REQUIRES:** IDB (fb-idb) must be installed.

Args:
  - device: Device UDID, name, or 'booted'
  - x, y: Coordinates
  - duration: Press duration in seconds (default 1.0)`,
      inputSchema: z.object({
        device: schemas.DeviceIdentifierSchema,
        x: z.number().describe("X coordinate"),
        y: z.number().describe("Y coordinate"),
        duration: z.number().default(1.0).describe("Press duration in seconds"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: { device: string; x: number; y: number; duration: number }) => {
      try {
        const udid = await resolveDevice(params.device);
        const hasIdb = await idb.isIdbInstalled();
        if (!hasIdb) {
          throw new Error("IDB not installed.");
        }
        await idb.longPress(udid, params.x, params.y, params.duration);
        return {
          content: [{ type: "text", text: `Long pressed at (${params.x}, ${params.y}) for ${params.duration}s.` }],
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
    "ios_find_element",
    {
      title: "Find UI Element",
      description: `Find a UI element by accessibility label or identifier.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Args:
  - label: Accessibility label to search for (optional)
  - identifier: Accessibility identifier to search for (optional)

Returns the element's view ID and frame coordinates.`,
      inputSchema: schemas.FindViewSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.FindViewSchema>) => {
      try {
        let response;
        if (params.label) {
          response = await debugClient.findViewByLabel(params.label);
        } else if (params.identifier) {
          response = await debugClient.findViewByIdentifier(params.identifier);
        } else {
          throw new Error("Either label or identifier must be provided");
        }

        if (!response.success) {
          throw new Error(response.error);
        }

        const { viewId, frame } = response.data!;
        return {
          content: [
            {
              type: "text",
              text: `Found element:\n- View ID: ${viewId}\n- Frame: (${frame.x}, ${frame.y}, ${frame.width}×${frame.height})`,
            },
          ],
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
    "ios_highlight_view",
    {
      title: "Highlight View",
      description: `Temporarily highlight a view for visual debugging.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Args:
  - view_id: View ID from the view hierarchy
  - color: Highlight color in hex (default: #FF0000)
  - duration: Duration in seconds (default: 2.0)`,
      inputSchema: schemas.HighlightViewSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.HighlightViewSchema>) => {
      try {
        const response = await debugClient.highlightView(
          params.view_id,
          params.color,
          params.duration
        );
        if (!response.success) {
          throw new Error(response.error);
        }
        return { content: [{ type: "text", text: `Highlighted view ${params.view_id} for ${params.duration}s.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
