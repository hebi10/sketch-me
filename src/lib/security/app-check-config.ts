export interface AppCheckConfiguration {
  clientEnabled: boolean;
  enforcementEnabled: boolean;
  siteKey: string;
}

export type AppCheckMode = 'disabled' | 'enabled' | 'misconfigured';

export function resolveAppCheckMode(input: AppCheckConfiguration): AppCheckMode {
  const hasSiteKey = input.siteKey.trim().length > 0;

  if (!input.clientEnabled && !input.enforcementEnabled && !hasSiteKey) return 'disabled';
  if (input.clientEnabled && input.enforcementEnabled && hasSiteKey) return 'enabled';
  return 'misconfigured';
}

export function assertProductionAppCheckConfiguration(input: AppCheckConfiguration) {
  if (resolveAppCheckMode(input) !== 'enabled') {
    throw new Error('APP_CHECK_PRODUCTION_CONFIGURATION_REQUIRED');
  }
}
