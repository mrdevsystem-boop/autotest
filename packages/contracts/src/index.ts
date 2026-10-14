export const PLATFORM_NAME = 'ai-testing-platform' as const;
export type RunnerType = 'PLAYWRIGHT' | 'SELENIUM' | 'PYTEST' | 'APPIUM_ANDROID' | 'APPIUM_IOS';
export type DeviceKind = 'ANDROID_EMULATOR' | 'ANDROID_REAL' | 'IOS_SIMULATOR' | 'IOS_REAL';
export type DeviceHealth = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';
export type DeviceAllocation = 'AVAILABLE' | 'RESERVED' | 'IN_USE' | 'CLEANING';
export interface HealthResponse { status: 'ok'; service: typeof PLATFORM_NAME; version: string }
export interface DeviceDescriptor { id: string; kind: DeviceKind; osVersion: string; hostId: string; health: DeviceHealth; allocation: DeviceAllocation }
/**
 * S1-06: Structured AI-generated web test-case contracts.
 * Runtime validation is required before accepting provider output.
 */
export type GeneratedWebStep =
  | { action: 'goto'; url: string }
  | { action: 'click'; selector: string }
  | { action: 'fill'; selector: string; value: string }
  | { action: 'expectText'; selector: string; text: string }
  | { action: 'expectTitle'; text: string };

export interface GenerateTestCasesRequest {
  suiteId: string;
  requirement: string;
  maxCases?: number;
}

export interface GeneratedTestCaseDraft {
  name: string;
  description: string;
  kind: 'web';
  steps: GeneratedWebStep[];
}

export interface GenerateTestCasesResponse {
  data: {
    drafts: GeneratedTestCaseDraft[];
  };
}
