import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../types.js";
import { debugClient } from "../services/debugServer.js";
import {
  truncateResponse,
  formatViewHierarchyMarkdown,
  formatConstraintsMarkdown,
} from "../services/formatters.js";
import * as schemas from "../schemas/index.js";

export function registerDebugTools(server: McpServer): void {
  server.registerTool(
    "ios_get_view_hierarchy",
    {
      title: "Get View Hierarchy",
      description: `Get the complete view hierarchy of the running app.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Returns a tree of all views with:
- Class names and view IDs
- Frame coordinates and sizes
- Accessibility labels/identifiers
- Hidden state, alpha, user interaction enabled
- Text content for labels/text fields

Args:
  - response_format: 'markdown' (default) or 'json'`,
      inputSchema: schemas.GetViewHierarchySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.GetViewHierarchySchema>) => {
      try {
        const response = await debugClient.getViewHierarchy();
        if (!response.success) {
          throw new Error(response.error);
        }

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(response.data, null, 2)
            : formatViewHierarchyMarkdown(response.data!);

        return { content: [{ type: "text", text: truncateResponse(text) }] };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}. Make sure ClaudeDebugKit is running in your app.`,
            },
          ],
        };
      }
    }
  );

  server.registerTool(
    "ios_get_constraints",
    {
      title: "Get View Constraints",
      description: `Get Auto Layout constraints for a specific view.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Args:
  - view_id: The view ID from the view hierarchy
  - response_format: 'markdown' or 'json'

Returns all constraints affecting the view.`,
      inputSchema: schemas.GetConstraintsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.GetConstraintsSchema>) => {
      try {
        const response = await debugClient.getConstraints(params.view_id);
        if (!response.success) {
          throw new Error(response.error);
        }

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(response.data, null, 2)
            : formatConstraintsMarkdown(response.data!);

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
    "ios_get_view_colors",
    {
      title: "Get View Colors",
      description: `Get color information for a view.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Args:
  - view_id: View ID from the hierarchy

Returns background color, text color, and tint color (if applicable).`,
      inputSchema: schemas.GetViewColorsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.GetViewColorsSchema>) => {
      try {
        const response = await debugClient.getViewColors(params.view_id);
        if (!response.success) {
          throw new Error(response.error);
        }

        const colors = response.data!;
        const lines = [`# Colors for ${params.view_id}`];
        if (colors.background) lines.push(`- **Background:** ${colors.background}`);
        if (colors.text) lines.push(`- **Text:** ${colors.text}`);
        if (colors.tint) lines.push(`- **Tint:** ${colors.tint}`);

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_get_font_info",
    {
      title: "Get Font Info",
      description: `Get font information for a text view.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Args:
  - view_id: View ID from the hierarchy

Returns font name, size, and weight.`,
      inputSchema: schemas.GetFontInfoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.GetFontInfoSchema>) => {
      try {
        const response = await debugClient.getFontInfo(params.view_id);
        if (!response.success) {
          throw new Error(response.error);
        }

        const font = response.data!;
        return {
          content: [
            {
              type: "text",
              text: `# Font Info\n- **Name:** ${font.fontName}\n- **Size:** ${font.fontSize}pt\n- **Weight:** ${font.fontWeight}`,
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
    "ios_get_interactive_elements",
    {
      title: "Get Interactive Elements",
      description: `Get all interactive elements (buttons, controls, etc.) in the view.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Returns a list of tappable elements with their labels and positions.`,
      inputSchema: schemas.GetInteractiveElementsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.GetInteractiveElementsSchema>) => {
      try {
        const response = await debugClient.getInteractiveElements();
        if (!response.success) {
          throw new Error(response.error);
        }

        const elements = response.data!;
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(elements, null, 2) }] };
        }

        const lines = ["# Interactive Elements\n"];
        for (const el of elements) {
          const label = el.label || el.viewId;
          lines.push(`- **${el.type}** "${label}" at (${el.frame.x}, ${el.frame.y})`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_get_responder_chain",
    {
      title: "Get Responder Chain",
      description: `Get the current responder chain (first responder and up).

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Useful for debugging input focus and event handling.`,
      inputSchema: schemas.GetResponderChainSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.GetResponderChainSchema>) => {
      try {
        const response = await debugClient.getResponderChain();
        if (!response.success) {
          throw new Error(response.error);
        }

        const chain = response.data!;
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(chain, null, 2) }] };
        }

        const lines = ["# Responder Chain\n"];
        for (let i = 0; i < chain.length; i++) {
          const r = chain[i];
          const prefix = i === 0 ? "→ " : "  ";
          lines.push(`${prefix}${r.className}${r.viewId ? ` (${r.viewId})` : ""}`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_override_traits",
    {
      title: "Override Trait Collection",
      description: `Override appearance traits for testing.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Args:
  - user_interface_style: 'light', 'dark', or 'unspecified'
  - content_size_category: Dynamic Type size category`,
      inputSchema: schemas.OverrideTraitsSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.OverrideTraitsSchema>) => {
      try {
        const response = await debugClient.overrideTraits({
          userInterfaceStyle: params.user_interface_style,
          preferredContentSizeCategory: params.content_size_category,
        });
        if (!response.success) {
          throw new Error(response.error);
        }
        return { content: [{ type: "text", text: `Trait overrides applied.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_get_traits",
    {
      title: "Get Trait Collection",
      description: `Get the current trait collection (appearance, size classes, etc.).

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.`,
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const response = await debugClient.getTraitCollection();
        if (!response.success) {
          throw new Error(response.error);
        }

        const traits = response.data!;
        const lines = [
          "# Trait Collection",
          `- **Interface Style:** ${traits.userInterfaceStyle}`,
          `- **Idiom:** ${traits.userInterfaceIdiom}`,
          `- **Display Scale:** ${traits.displayScale}x`,
          `- **Horizontal Size Class:** ${traits.horizontalSizeClass}`,
          `- **Vertical Size Class:** ${traits.verticalSizeClass}`,
          `- **Content Size Category:** ${traits.preferredContentSizeCategory}`,
        ];

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_get_memory_stats",
    {
      title: "Get Memory Stats",
      description: `Get memory usage statistics.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.`,
      inputSchema: schemas.GetMemoryStatsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const response = await debugClient.getMemoryStats();
        if (!response.success) {
          throw new Error(response.error);
        }

        const stats = response.data!;
        const usedMB = (stats.usedMemory / 1024 / 1024).toFixed(1);
        const totalMB = (stats.totalMemory / 1024 / 1024).toFixed(1);

        return {
          content: [
            {
              type: "text",
              text: `# Memory Stats\n- **Used:** ${usedMB} MB\n- **Total:** ${totalMB} MB\n- **Views:** ${stats.viewCount}\n- **Layers:** ${stats.layerCount}`,
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
    "ios_simulate_memory_warning",
    {
      title: "Simulate Memory Warning",
      description: `Send a simulated memory warning to the app.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Useful for testing memory pressure handling.`,
      inputSchema: schemas.SimulateMemoryWarningSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const response = await debugClient.simulateMemoryWarning();
        if (!response.success) {
          throw new Error(response.error);
        }
        return { content: [{ type: "text", text: `Memory warning sent to app.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ios_export_view_image",
    {
      title: "Export View as Image",
      description: `Export a specific view as a PNG image.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Args:
  - view_id: View ID to export

Returns the view rendered as a base64 PNG.`,
      inputSchema: schemas.ExportViewImageSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.ExportViewImageSchema>) => {
      try {
        const response = await debugClient.exportViewAsImage(params.view_id);
        if (!response.success) {
          throw new Error(response.error);
        }

        return {
          content: [{ type: "image", data: response.data!.base64, mimeType: "image/png" }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
