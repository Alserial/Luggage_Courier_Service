import { appConfig, isCloudBaseConfigured } from '../config/env';

export type CloudResult = {
  ok: boolean;
  error?: string;
};

type CloudCallOptions<T extends CloudResult> = {
  name: string;
  data?: Record<string, unknown>;
  demoFallback?: T;
};

function unavailableResult<T extends CloudResult>(options: CloudCallOptions<T>): T {
  if (appConfig.demoMode && options.demoFallback) {
    return options.demoFallback;
  }
  return { ok: false, error: 'cloud_unavailable' } as T;
}

export async function callCloud<T extends CloudResult>(options: CloudCallOptions<T>): Promise<T> {
  if (appConfig.demoMode) {
    return unavailableResult(options);
  }
  if (!wx.cloud || !isCloudBaseConfigured()) {
    return unavailableResult(options);
  }

  try {
    const result = await wx.cloud.callFunction({
      name: options.name,
      data: options.data || {},
    });
    const payload = result.result as T | null | undefined;
    if (!payload || typeof payload !== 'object' || typeof payload.ok !== 'boolean') {
      return unavailableResult(options);
    }
    return payload;
  } catch (error) {
    console.warn(`Cloud function ${options.name} failed`, error);
    return unavailableResult(options);
  }
}

export async function uploadCloudFile(cloudPath: string, filePath: string): Promise<string> {
  if (appConfig.demoMode) {
    return `demo://${cloudPath}`;
  }
  if (!wx.cloud || !isCloudBaseConfigured()) {
    throw new Error('cloud_not_configured');
  }

  const result = await wx.cloud.uploadFile({ cloudPath, filePath });
  if (!result.fileID) throw new Error('missing_file_id');
  return result.fileID;
}

export async function getCloudFileUrls(fileIds: string[]): Promise<string[]> {
  if (!fileIds.length) return [];
  if (appConfig.demoMode) return fileIds;
  if (!wx.cloud || !isCloudBaseConfigured()) throw new Error('cloud_not_configured');
  const result = await wx.cloud.getTempFileURL({ fileList: fileIds });
  return result.fileList
    .filter((file) => file.status === 0 && Boolean(file.tempFileURL))
    .map((file) => file.tempFileURL);
}
