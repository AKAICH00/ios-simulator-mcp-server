import {
  ViewHierarchy,
  ConstraintInfo,
  TouchTargetAudit,
  ContrastCheckResult,
  DebugServerResponse,
} from "../types.js";
import { DEBUG_SERVER_PORT, DEBUG_SERVER_HOST } from "../constants.js";

/**
 * Client for communicating with the ClaudeDebugKit server running in the iOS app
 */
export class DebugServerClient {
  private baseUrl: string;

  constructor(port: number = DEBUG_SERVER_PORT, host: string = DEBUG_SERVER_HOST) {
    this.baseUrl = `http://${host}:${port}`;
  }

  private async request<T>(
    endpoint: string,
    method: string = "GET",
    body?: unknown
  ): Promise<DebugServerResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { success: true, data: data as T };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to connect to debug server: ${errorMessage}. Make sure ClaudeDebugKit is running in your app.`,
      };
    }
  }

  /**
   * Check if the debug server is running
   */
  async ping(): Promise<boolean> {
    const response = await this.request<{ status: string }>("/ping");
    return response.success;
  }

  /**
   * Get the complete view hierarchy
   */
  async getViewHierarchy(): Promise<DebugServerResponse<ViewHierarchy>> {
    return this.request<ViewHierarchy>("/hierarchy");
  }

  /**
   * Get constraints for a specific view
   */
  async getConstraints(viewId: string): Promise<DebugServerResponse<ConstraintInfo>> {
    return this.request<ConstraintInfo>(`/constraints/${encodeURIComponent(viewId)}`);
  }

  /**
   * Find view by accessibility label
   */
  async findViewByLabel(
    label: string
  ): Promise<DebugServerResponse<{ viewId: string; frame: { x: number; y: number; width: number; height: number } }>> {
    return this.request(`/find/label/${encodeURIComponent(label)}`);
  }

  /**
   * Find view by accessibility identifier
   */
  async findViewByIdentifier(
    identifier: string
  ): Promise<DebugServerResponse<{ viewId: string; frame: { x: number; y: number; width: number; height: number } }>> {
    return this.request(`/find/identifier/${encodeURIComponent(identifier)}`);
  }

  /**
   * Tap a view by its accessibility label
   */
  async tapByLabel(label: string): Promise<DebugServerResponse<{ tapped: boolean }>> {
    return this.request(`/tap/label/${encodeURIComponent(label)}`, "POST");
  }

  /**
   * Tap a view by coordinates
   */
  async tapAtPoint(
    x: number,
    y: number
  ): Promise<DebugServerResponse<{ tapped: boolean }>> {
    return this.request(`/tap/point`, "POST", { x, y });
  }

  /**
   * Get color information for a view
   */
  async getViewColors(
    viewId: string
  ): Promise<DebugServerResponse<{ background?: string; text?: string; tint?: string }>> {
    return this.request(`/colors/${encodeURIComponent(viewId)}`);
  }

  /**
   * Audit touch targets for minimum size compliance
   */
  async auditTouchTargets(): Promise<DebugServerResponse<TouchTargetAudit[]>> {
    return this.request<TouchTargetAudit[]>("/audit/touch-targets");
  }

  /**
   * Check color contrast for text views
   */
  async auditContrast(): Promise<DebugServerResponse<ContrastCheckResult[]>> {
    return this.request<ContrastCheckResult[]>("/audit/contrast");
  }

  /**
   * Get font information for a view
   */
  async getFontInfo(
    viewId: string
  ): Promise<DebugServerResponse<{ fontName: string; fontSize: number; fontWeight: string }>> {
    return this.request(`/font/${encodeURIComponent(viewId)}`);
  }

  /**
   * Get all interactive elements
   */
  async getInteractiveElements(): Promise<
    DebugServerResponse<Array<{ viewId: string; type: string; label?: string; frame: { x: number; y: number; width: number; height: number } }>>
  > {
    return this.request("/interactive");
  }

  /**
   * Highlight a view temporarily (for debugging)
   */
  async highlightView(
    viewId: string,
    color?: string,
    duration?: number
  ): Promise<DebugServerResponse<{ highlighted: boolean }>> {
    return this.request(`/highlight/${encodeURIComponent(viewId)}`, "POST", {
      color: color || "#FF0000",
      duration: duration || 2.0,
    });
  }

  /**
   * Get accessibility information for a view
   */
  async getAccessibilityInfo(viewId: string): Promise<
    DebugServerResponse<{
      label?: string;
      identifier?: string;
      hint?: string;
      value?: string;
      traits: string[];
      isAccessibilityElement: boolean;
    }>
  > {
    return this.request(`/accessibility/${encodeURIComponent(viewId)}`);
  }

  /**
   * Get the current responder chain
   */
  async getResponderChain(): Promise<
    DebugServerResponse<Array<{ className: string; viewId?: string }>>
  > {
    return this.request("/responder-chain");
  }

  /**
   * Get all views with Auto Layout issues
   */
  async getLayoutIssues(): Promise<
    DebugServerResponse<
      Array<{
        viewId: string;
        issue: string;
        hasAmbiguousLayout: boolean;
        translatesAutoresizingMaskIntoConstraints: boolean;
      }>
    >
  > {
    return this.request("/audit/layout");
  }

  /**
   * Force layout update
   */
  async forceLayout(): Promise<DebugServerResponse<{ updated: boolean }>> {
    return this.request("/layout/update", "POST");
  }

  /**
   * Get memory usage stats
   */
  async getMemoryStats(): Promise<
    DebugServerResponse<{
      usedMemory: number;
      totalMemory: number;
      viewCount: number;
      layerCount: number;
    }>
  > {
    return this.request("/stats/memory");
  }

  /**
   * Get render performance metrics
   */
  async getRenderMetrics(): Promise<
    DebugServerResponse<{
      fps: number;
      droppedFrames: number;
      gpuTime: number;
      cpuTime: number;
    }>
  > {
    return this.request("/stats/render");
  }

  /**
   * Export view as image (returns base64)
   */
  async exportViewAsImage(viewId: string): Promise<DebugServerResponse<{ base64: string }>> {
    return this.request(`/export/image/${encodeURIComponent(viewId)}`);
  }

  /**
   * Set user defaults value (for testing)
   */
  async setUserDefault(
    key: string,
    value: unknown
  ): Promise<DebugServerResponse<{ set: boolean }>> {
    return this.request("/defaults/set", "POST", { key, value });
  }

  /**
   * Get user defaults value
   */
  async getUserDefault(key: string): Promise<DebugServerResponse<{ value: unknown }>> {
    return this.request(`/defaults/get/${encodeURIComponent(key)}`);
  }

  /**
   * Trigger a specific notification for testing
   */
  async postNotification(
    name: string,
    userInfo?: Record<string, unknown>
  ): Promise<DebugServerResponse<{ posted: boolean }>> {
    return this.request("/notification/post", "POST", { name, userInfo });
  }

  /**
   * Simulate memory warning
   */
  async simulateMemoryWarning(): Promise<DebugServerResponse<{ sent: boolean }>> {
    return this.request("/simulate/memory-warning", "POST");
  }

  /**
   * Get current trait collection
   */
  async getTraitCollection(): Promise<
    DebugServerResponse<{
      userInterfaceStyle: string;
      userInterfaceIdiom: string;
      displayScale: number;
      horizontalSizeClass: string;
      verticalSizeClass: string;
      preferredContentSizeCategory: string;
    }>
  > {
    return this.request("/traits");
  }

  /**
   * Override trait collection (for testing different appearances)
   */
  async overrideTraits(traits: {
    userInterfaceStyle?: "light" | "dark" | "unspecified";
    preferredContentSizeCategory?: string;
  }): Promise<DebugServerResponse<{ overridden: boolean }>> {
    return this.request("/traits/override", "POST", traits);
  }
}

// Export singleton instance
export const debugClient = new DebugServerClient();
