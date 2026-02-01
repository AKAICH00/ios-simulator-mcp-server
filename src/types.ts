// iOS Simulator types

export interface SimulatorDevice {
  udid: string;
  name: string;
  state: "Booted" | "Shutdown" | "Creating" | "Booting" | "Shutting Down";
  deviceTypeIdentifier: string;
  runtime: string;
  isAvailable: boolean;
  availabilityError?: string;
}

export interface SimulatorRuntime {
  identifier: string;
  name: string;
  version: string;
  isAvailable: boolean;
}

export interface DeviceList {
  devices: Record<string, SimulatorDevice[]>;
}

export interface ViewElement {
  id: string;
  className: string;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  accessibilityLabel?: string;
  accessibilityIdentifier?: string;
  accessibilityValue?: string;
  accessibilityTraits?: string[];
  isHidden: boolean;
  isUserInteractionEnabled: boolean;
  alpha: number;
  backgroundColor?: string;
  text?: string;
  placeholder?: string;
  isEnabled?: boolean;
  isSelected?: boolean;
  children: ViewElement[];
}

export interface ViewHierarchy {
  rootView: ViewElement;
  timestamp: string;
  bundleIdentifier: string;
  screenSize: {
    width: number;
    height: number;
  };
}

export interface ConstraintInfo {
  viewId: string;
  constraints: {
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
  }[];
}

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  alpha: number;
}

export interface TouchTargetAudit {
  viewId: string;
  accessibilityLabel?: string;
  frame: { x: number; y: number; width: number; height: number };
  touchableArea: number;
  meetsMinimum: boolean;
  recommendation?: string;
}

export interface ContrastCheckResult {
  viewId: string;
  foregroundColor: ColorInfo;
  backgroundColor: ColorInfo;
  contrastRatio: number;
  meetsWCAG_AA: boolean;
  meetsWCAG_AAA: boolean;
  text?: string;
  fontSize?: number;
}

export interface AppLog {
  timestamp: string;
  level: "debug" | "info" | "warning" | "error" | "fault";
  subsystem?: string;
  category?: string;
  message: string;
}

export interface DebugServerResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export enum ResponseFormat {
  JSON = "json",
  MARKDOWN = "markdown"
}
