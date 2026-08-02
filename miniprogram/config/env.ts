export const cloudEnvId: string = 'luggage-d1ghv33fy2cb9ef96';
export const cloudEnvPlaceholder = 'replace-with-cloudbase-env-id';

export function isCloudBaseConfigured(): boolean {
  return Boolean(cloudEnvId && cloudEnvId !== cloudEnvPlaceholder);
}

export const appConfig = {
  demoMode: false,
  valueCapCny: 2000,
  weightCapKg: 5,
  supportedRoutes: ['中国-澳大利亚', '澳大利亚-中国'],
};
