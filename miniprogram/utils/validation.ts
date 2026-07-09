import { appConfig } from '../config/env';
import type { ItemRequestDraft, TripDraft } from '../types/index';

export function validateTripDraft(draft: TripDraft): string | null {
  if (!draft.fromCity || !draft.toCity) return '请填写出发城市和到达城市';
  if (draft.fromCity === draft.toCity) return '出发城市和到达城市不能相同';
  if (!draft.departureDate || !draft.arrivalDate) return '请选择出发和到达日期';
  if (!draft.luggageCapacityKg || draft.luggageCapacityKg <= 0) return '请填写可用重量';
  if (draft.luggageCapacityKg > appConfig.weightCapKg) return `MVP 阶段单次可用重量上限为 ${appConfig.weightCapKg}kg`;
  if (!draft.acceptableCategories.length) return '请至少选择一个可接受品类';
  if (/什么都|都可以|不限|随便/.test(draft.note)) return '请明确可接受范围，不能填写泛化承诺';
  return null;
}

export function validateItemRequestDraft(draft: ItemRequestDraft): string | null {
  if (!draft.itemName) return '请填写物品名称';
  if (!draft.category) return '请选择物品品类';
  if (!draft.quantity || draft.quantity <= 0) return '请填写合理数量';
  if (!draft.declaredValue || draft.declaredValue <= 0) return '请填写申报价值';
  if (draft.declaredValue > appConfig.valueCapCny) return `MVP 阶段申报价值上限为 ${appConfig.valueCapCny} 元`;
  if (!draft.estimatedWeightKg || draft.estimatedWeightKg <= 0) return '请填写预估重量';
  if (draft.estimatedWeightKg > appConfig.weightCapKg) return `MVP 阶段重量上限为 ${appConfig.weightCapKg}kg`;
  if (!draft.pickupCity || !draft.deliveryCity) return '请填写交接城市和交付城市';
  if (!draft.deadline) return '请选择最晚送达日期';
  if (!draft.riskDeclarationAccepted) return '请先确认风险和海关责任声明';
  return null;
}
