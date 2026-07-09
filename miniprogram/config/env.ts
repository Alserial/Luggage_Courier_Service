export const cloudEnvId = 'replace-with-cloudbase-env-id';
export const cloudEnvPlaceholder = 'replace-with-cloudbase-env-id';

export function isCloudBaseConfigured(): boolean {
  return Boolean(cloudEnvId && cloudEnvId !== cloudEnvPlaceholder);
}

export const appConfig = {
  valueCapCny: 2000,
  weightCapKg: 5,
  supportedRoutes: ['中国-澳大利亚', '澳大利亚-中国'],
};
