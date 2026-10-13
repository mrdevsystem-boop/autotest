export const PLATFORM_NAME = 'ai-testing-platform' as const;
export type RunnerType = 'PLAYWRIGHT' | 'SELENIUM' | 'PYTEST' | 'APPIUM_ANDROID' | 'APPIUM_IOS';
export type DeviceKind = 'ANDROID_EMULATOR' | 'ANDROID_REAL' | 'IOS_SIMULATOR' | 'IOS_REAL';
export type DeviceHealth = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';
export type DeviceAllocation = 'AVAILABLE' | 'RESERVED' | 'IN_USE' | 'CLEANING';
export interface HealthResponse { status: 'ok'; service: typeof PLATFORM_NAME; version: string }
export interface DeviceDescriptor { id: string; kind: DeviceKind; osVersion: string; hostId: string; health: DeviceHealth; allocation: DeviceAllocation }
