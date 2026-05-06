export const RUNTIME_IS_PACKAGED_ENV = 'INKLINE_RUNTIME_IS_PACKAGED';
export const RUNTIME_RESOURCES_PATH_ENV = 'INKLINE_RESOURCES_PATH';

export function isTruthyEnvValue(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
}

export function isPackagedRuntime(appIsPackaged: boolean, runtimeFlag = process.env[RUNTIME_IS_PACKAGED_ENV]): boolean {
  return appIsPackaged || isTruthyEnvValue(runtimeFlag);
}

export function getPackagedResourcesPath(resourcesPath = process.resourcesPath): string {
  return process.env[RUNTIME_RESOURCES_PATH_ENV] ?? resourcesPath;
}
