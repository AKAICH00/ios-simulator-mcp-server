import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResponseFormat } from "../types.js";
import { debugClient } from "../services/debugServer.js";
import {
  formatTouchTargetAuditMarkdown,
  formatContrastAuditMarkdown,
} from "../services/formatters.js";
import * as schemas from "../schemas/index.js";

export function registerAuditTools(server: McpServer): void {
  server.registerTool(
    "ios_audit_touch_targets",
    {
      title: "Audit Touch Targets",
      description: `Audit all interactive elements for minimum touch target size (44×44pt).

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Returns a report of all buttons, controls, and tappable elements that don't meet
Apple's Human Interface Guidelines minimum touch target size.

Args:
  - response_format: 'markdown' or 'json'`,
      inputSchema: schemas.TouchTargetAuditSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.TouchTargetAuditSchema>) => {
      try {
        const response = await debugClient.auditTouchTargets();
        if (!response.success) {
          throw new Error(response.error);
        }

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(response.data, null, 2)
            : formatTouchTargetAuditMarkdown(response.data!);

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
    "ios_audit_contrast",
    {
      title: "Audit Color Contrast",
      description: `Audit text elements for WCAG color contrast compliance.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Checks all text views and returns contrast ratios with WCAG AA/AAA compliance status.

Args:
  - response_format: 'markdown' or 'json'`,
      inputSchema: schemas.ContrastAuditSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.ContrastAuditSchema>) => {
      try {
        const response = await debugClient.auditContrast();
        if (!response.success) {
          throw new Error(response.error);
        }

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(response.data, null, 2)
            : formatContrastAuditMarkdown(response.data!);

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
    "ios_audit_layout",
    {
      title: "Audit Auto Layout Issues",
      description: `Find views with Auto Layout problems.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Detects:
- Ambiguous layouts
- Unsatisfiable constraints
- Views with translatesAutoresizingMaskIntoConstraints still true

Args:
  - response_format: 'markdown' or 'json'`,
      inputSchema: schemas.LayoutAuditSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof schemas.LayoutAuditSchema>) => {
      try {
        const response = await debugClient.getLayoutIssues();
        if (!response.success) {
          throw new Error(response.error);
        }

        const issues = response.data || [];

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(issues, null, 2) }] };
        }

        if (issues.length === 0) {
          return { content: [{ type: "text", text: "✅ No Auto Layout issues detected." }] };
        }

        const lines = ["# Auto Layout Issues\n"];
        for (const issue of issues) {
          lines.push(`## ${issue.viewId}`);
          lines.push(`- **Issue:** ${issue.issue}`);
          lines.push(`- **Ambiguous:** ${issue.hasAmbiguousLayout}`);
          lines.push(`- **translatesAutoresizingMaskIntoConstraints:** ${issue.translatesAutoresizingMaskIntoConstraints}`);
          lines.push("");
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
    "ios_audit_accessibility",
    {
      title: "Audit Accessibility",
      description: `Audit views for accessibility issues.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Checks for:
- Missing accessibility labels on interactive elements
- Images without accessibility descriptions
- Buttons without labels
- Touch targets that are too small

Args:
  - response_format: 'markdown' or 'json'`,
      inputSchema: z.object({
        response_format: schemas.ResponseFormatSchema,
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: { response_format: ResponseFormat }) => {
      try {
        // Get interactive elements and check for missing labels
        const interactiveResponse = await debugClient.getInteractiveElements();
        if (!interactiveResponse.success) {
          throw new Error(interactiveResponse.error);
        }

        const touchTargetResponse = await debugClient.auditTouchTargets();
        const touchTargets = touchTargetResponse.success ? touchTargetResponse.data || [] : [];

        const elements = interactiveResponse.data || [];
        const issues: Array<{ viewId: string; type: string; issue: string; severity: string }> = [];

        // Check for missing labels
        for (const el of elements) {
          if (!el.label && el.type !== "UIView") {
            issues.push({
              viewId: el.viewId,
              type: el.type,
              issue: "Missing accessibility label",
              severity: "high",
            });
          }
        }

        // Add touch target issues
        for (const tt of touchTargets) {
          if (!tt.meetsMinimum) {
            issues.push({
              viewId: tt.viewId,
              type: "touch_target",
              issue: `Touch target too small: ${tt.frame.width}×${tt.frame.height}pt (minimum 44×44pt)`,
              severity: "medium",
            });
          }
        }

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(issues, null, 2) }] };
        }

        if (issues.length === 0) {
          return { content: [{ type: "text", text: "✅ No accessibility issues detected." }] };
        }

        const high = issues.filter((i) => i.severity === "high");
        const medium = issues.filter((i) => i.severity === "medium");

        const lines = ["# Accessibility Audit\n"];

        if (high.length > 0) {
          lines.push("## ❌ High Severity\n");
          for (const issue of high) {
            lines.push(`- **${issue.type}** (${issue.viewId}): ${issue.issue}`);
          }
          lines.push("");
        }

        if (medium.length > 0) {
          lines.push("## ⚠️ Medium Severity\n");
          for (const issue of medium) {
            lines.push(`- **${issue.type}** (${issue.viewId}): ${issue.issue}`);
          }
          lines.push("");
        }

        lines.push(`\n**Total Issues:** ${issues.length} (${high.length} high, ${medium.length} medium)`);

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
    "ios_audit_all",
    {
      title: "Run Full UI/UX Audit",
      description: `Run a comprehensive UI/UX audit including touch targets, contrast, layout, and accessibility.

**REQUIRES:** ClaudeDebugKit must be integrated into the running iOS app.

Returns a combined report with all issues found.`,
      inputSchema: z.object({
        response_format: schemas.ResponseFormatSchema,
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: { response_format: ResponseFormat }) => {
      try {
        const results: Record<string, unknown> = {};
        const lines: string[] = ["# Full UI/UX Audit Report\n"];

        // Touch targets
        const touchResponse = await debugClient.auditTouchTargets();
        if (touchResponse.success) {
          const failing = (touchResponse.data || []).filter((t) => !t.meetsMinimum);
          results.touchTargets = { total: touchResponse.data?.length || 0, failing: failing.length };
          lines.push(`## Touch Targets`);
          lines.push(failing.length === 0 ? "✅ All touch targets meet minimum size" : `⚠️ ${failing.length} elements below 44×44pt`);
          lines.push("");
        }

        // Contrast
        const contrastResponse = await debugClient.auditContrast();
        if (contrastResponse.success) {
          const failing = (contrastResponse.data || []).filter((c) => !c.meetsWCAG_AA);
          results.contrast = { total: contrastResponse.data?.length || 0, failing: failing.length };
          lines.push(`## Color Contrast`);
          lines.push(failing.length === 0 ? "✅ All text meets WCAG AA contrast" : `⚠️ ${failing.length} elements fail WCAG AA`);
          lines.push("");
        }

        // Layout
        const layoutResponse = await debugClient.getLayoutIssues();
        if (layoutResponse.success) {
          const issues = layoutResponse.data || [];
          results.layout = { issues: issues.length };
          lines.push(`## Auto Layout`);
          lines.push(issues.length === 0 ? "✅ No layout issues" : `⚠️ ${issues.length} layout issues detected`);
          lines.push("");
        }

        // Interactive elements (accessibility)
        const interactiveResponse = await debugClient.getInteractiveElements();
        if (interactiveResponse.success) {
          const noLabel = (interactiveResponse.data || []).filter((e) => !e.label);
          results.accessibility = {
            total: interactiveResponse.data?.length || 0,
            missingLabels: noLabel.length,
          };
          lines.push(`## Accessibility`);
          lines.push(noLabel.length === 0 ? "✅ All interactive elements have labels" : `⚠️ ${noLabel.length} elements missing accessibility labels`);
          lines.push("");
        }

        // Summary
        const totalIssues =
          (results.touchTargets as { failing: number })?.failing || 0 +
          (results.contrast as { failing: number })?.failing || 0 +
          (results.layout as { issues: number })?.issues || 0 +
          (results.accessibility as { missingLabels: number })?.missingLabels || 0;

        lines.push("---");
        lines.push(`**Total Issues Found:** ${totalIssues}`);
        lines.push("\n*Run individual audits for detailed information.*");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
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
}
