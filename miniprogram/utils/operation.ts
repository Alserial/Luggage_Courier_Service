export function createOperationId(scope: string): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `${scope}_${Date.now()}_${random}`;
}
