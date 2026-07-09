type CloudCallOptions<T> = {
  name: string;
  data?: Record<string, unknown>;
  fallback: T;
};

export async function callCloud<T>(options: CloudCallOptions<T>): Promise<T> {
  if (!wx.cloud) {
    return options.fallback;
  }

  try {
    const result = await wx.cloud.callFunction({
      name: options.name,
      data: options.data || {},
    });
    return (result.result as T) || options.fallback;
  } catch (error) {
    console.warn(`Cloud function ${options.name} failed`, error);
    return options.fallback;
  }
}
