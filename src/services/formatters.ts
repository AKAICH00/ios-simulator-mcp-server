import { ResponseFormat, ViewElement, ViewHierarchy } from "../types.js";
import { CHARACTER_LIMIT } from "../constants.js";

/**
 * Format response based on requested format
 */
export function formatResponse<T>(
  data: T,
  format: ResponseFormat,
  markdownFormatter?: (data: T) => string
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(data, null, 2);
  }

  if (markdownFormatter) {
    return markdownFormatter(data);
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Truncate response if too long
 */
export function truncateResponse(
  text: string,
  limit: number = CHARACTER_LIMIT
): string {
  if (text.length <= limit) {
    return text;
  }

  return (
    text.slice(0, limit - 100) +
    "\n\n... [Response truncated. Use more specific queries or pagination.]"
  );
}

/**
 * Format view hierarchy as markdown
 */
export function formatViewHierarchyMarkdown(hierarchy: ViewHierarchy): string {
  const lines: string[] = [];

  lines.push(`# View Hierarchy`);
  lines.push(`**Bundle:** ${hierarchy.bundleIdentifier}`);
  lines.push(
    `**Screen:** ${hierarchy.screenSize.width}x${hierarchy.screenSize.height}`
  );
  lines.push(`**Captured:** ${hierarchy.timestamp}`);
  lines.push("");

  function formatView(view: ViewElement, depth: number): void {
    const indent = "  ".repeat(depth);
    const frameStr = `(${view.frame.x}, ${view.frame.y}, ${view.frame.width}×${view.frame.height})`;

    let line = `${indent}- **${view.className}** ${frameStr}`;

    const attrs: string[] = [];
    if (view.accessibilityLabel) {
      attrs.push(`label="${view.accessibilityLabel}"`);
    }
    if (view.accessibilityIdentifier) {
      attrs.push(`id="${view.accessibilityIdentifier}"`);
    }
    if (view.text) {
      attrs.push(`text="${view.text.slice(0, 50)}${view.text.length > 50 ? "..." : ""}"`);
    }
    if (view.isHidden) {
      attrs.push("hidden");
    }
    if (!view.isUserInteractionEnabled) {
      attrs.push("!interactive");
    }
    if (view.alpha < 1) {
      attrs.push(`alpha=${view.alpha.toFixed(2)}`);
    }

    if (attrs.length > 0) {
      line += ` [${attrs.join(", ")}]`;
    }

    lines.push(line);

    for (const child of view.children) {
      formatView(child, depth + 1);
    }
  }

  formatView(hierarchy.rootView, 0);

  return lines.join("\n");
}

/**
 * Format device list as markdown
 */
export function formatDeviceListMarkdown(
  devices: Array<{
    udid: string;
    name: string;
    state: string;
    runtime: string;
    isAvailable: boolean;
  }>
): string {
  const lines: string[] = [];

  lines.push("# iOS Simulators\n");

  // Group by runtime
  const byRuntime = new Map<string, typeof devices>();
  for (const device of devices) {
    const runtime = device.runtime;
    if (!byRuntime.has(runtime)) {
      byRuntime.set(runtime, []);
    }
    byRuntime.get(runtime)!.push(device);
  }

  for (const [runtime, runtimeDevices] of byRuntime) {
    lines.push(`## ${runtime}\n`);

    for (const device of runtimeDevices) {
      const statusIcon = device.state === "Booted" ? "🟢" : "⚪";
      const availableStr = device.isAvailable ? "" : " ⚠️ unavailable";
      lines.push(
        `${statusIcon} **${device.name}**${availableStr}`
      );
      lines.push(`   - UDID: \`${device.udid}\``);
      lines.push(`   - State: ${device.state}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Format touch target audit as markdown
 */
export function formatTouchTargetAuditMarkdown(
  audit: Array<{
    viewId: string;
    accessibilityLabel?: string;
    frame: { x: number; y: number; width: number; height: number };
    touchableArea: number;
    meetsMinimum: boolean;
    recommendation?: string;
  }>
): string {
  const lines: string[] = [];

  lines.push("# Touch Target Audit\n");

  const failing = audit.filter((a) => !a.meetsMinimum);
  const passing = audit.filter((a) => a.meetsMinimum);

  if (failing.length === 0) {
    lines.push("✅ **All touch targets meet minimum size requirements (44×44pt)**\n");
  } else {
    lines.push(
      `⚠️ **${failing.length} touch targets are below minimum size**\n`
    );

    lines.push("## Issues\n");
    for (const item of failing) {
      const label = item.accessibilityLabel || item.viewId;
      lines.push(`### ${label}`);
      lines.push(
        `- **Size:** ${item.frame.width}×${item.frame.height}pt (area: ${item.touchableArea}pt²)`
      );
      lines.push(
        `- **Position:** (${item.frame.x}, ${item.frame.y})`
      );
      if (item.recommendation) {
        lines.push(`- **Recommendation:** ${item.recommendation}`);
      }
      lines.push("");
    }
  }

  lines.push(`\n**Summary:** ${passing.length} passing, ${failing.length} failing`);

  return lines.join("\n");
}

/**
 * Format contrast audit as markdown
 */
export function formatContrastAuditMarkdown(
  results: Array<{
    viewId: string;
    foregroundColor: { hex: string };
    backgroundColor: { hex: string };
    contrastRatio: number;
    meetsWCAG_AA: boolean;
    meetsWCAG_AAA: boolean;
    text?: string;
    fontSize?: number;
  }>
): string {
  const lines: string[] = [];

  lines.push("# Color Contrast Audit\n");

  const failing = results.filter((r) => !r.meetsWCAG_AA);
  const aaOnly = results.filter((r) => r.meetsWCAG_AA && !r.meetsWCAG_AAA);
  const aaa = results.filter((r) => r.meetsWCAG_AAA);

  if (failing.length > 0) {
    lines.push("## ❌ Failing WCAG AA\n");
    for (const item of failing) {
      const textPreview = item.text
        ? `"${item.text.slice(0, 30)}${item.text.length > 30 ? "..." : ""}"`
        : item.viewId;
      lines.push(`### ${textPreview}`);
      lines.push(`- **Contrast Ratio:** ${item.contrastRatio.toFixed(2)}:1`);
      lines.push(
        `- **Colors:** ${item.foregroundColor.hex} on ${item.backgroundColor.hex}`
      );
      if (item.fontSize) {
        lines.push(`- **Font Size:** ${item.fontSize}pt`);
      }
      lines.push(`- **Required:** 4.5:1 (AA) / 7:1 (AAA)`);
      lines.push("");
    }
  }

  if (aaOnly.length > 0) {
    lines.push("## ✅ Passing AA (not AAA)\n");
    for (const item of aaOnly) {
      const textPreview = item.text
        ? `"${item.text.slice(0, 30)}..."`
        : item.viewId;
      lines.push(
        `- ${textPreview}: ${item.contrastRatio.toFixed(2)}:1 (${item.foregroundColor.hex}/${item.backgroundColor.hex})`
      );
    }
    lines.push("");
  }

  lines.push(
    `\n**Summary:** ${aaa.length} AAA, ${aaOnly.length} AA only, ${failing.length} failing`
  );

  return lines.join("\n");
}

/**
 * Format logs as markdown
 */
export function formatLogsMarkdown(
  logs: Array<{
    timestamp: string;
    level: string;
    subsystem?: string;
    category?: string;
    message: string;
  }>
): string {
  const lines: string[] = [];

  lines.push("# App Logs\n");

  const levelIcons: Record<string, string> = {
    debug: "🔍",
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    fault: "💥",
  };

  for (const log of logs) {
    const icon = levelIcons[log.level] || "📝";
    const subsystem = log.subsystem ? `[${log.subsystem}]` : "";
    const category = log.category ? `(${log.category})` : "";
    lines.push(
      `${icon} **${log.timestamp}** ${subsystem}${category}`
    );
    lines.push(`   ${log.message}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format constraint info as markdown
 */
export function formatConstraintsMarkdown(info: {
  viewId: string;
  constraints: Array<{
    identifier?: string;
    firstItem: string;
    firstAttribute: string;
    relation: string;
    secondItem?: string;
    secondAttribute?: string;
    multiplier: number;
    constant: number;
    priority: number;
    isActive: boolean;
  }>;
}): string {
  const lines: string[] = [];

  lines.push(`# Constraints for ${info.viewId}\n`);

  for (const c of info.constraints) {
    const name = c.identifier || "constraint";
    const active = c.isActive ? "" : " (inactive)";
    const priority = c.priority < 1000 ? ` @${c.priority}` : "";

    let equation = `${c.firstItem}.${c.firstAttribute}`;
    equation += ` ${c.relation} `;

    if (c.secondItem) {
      equation += `${c.secondItem}.${c.secondAttribute}`;
      if (c.multiplier !== 1) {
        equation += ` × ${c.multiplier}`;
      }
    }

    if (c.constant !== 0) {
      equation += c.constant > 0 ? ` + ${c.constant}` : ` - ${Math.abs(c.constant)}`;
    }

    lines.push(`- **${name}**${active}${priority}`);
    lines.push(`  \`${equation}\``);
    lines.push("");
  }

  return lines.join("\n");
}
