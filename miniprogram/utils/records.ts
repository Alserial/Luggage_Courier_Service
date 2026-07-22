import { demoOffer, demoOrder, demoRequest, demoTrip } from '../services/mock';
import type { MockOrder } from '../services/mock';
import { formatMoney } from './fees';
import { getCategoryLabel } from './categories';
import { orderStatusLabels } from './order-state';
import type { OrderStatus } from '../types/index';

function getId(record: Record<string, unknown>, fallback: string): string {
  return String(record._id || record.id || fallback);
}

function text(value: unknown, fallback = ''): string {
  return String(value || fallback);
}

function formatDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function city(location: unknown): string {
  if (location && typeof location === 'object' && 'city' in location) {
    return text((location as { city?: string }).city);
  }
  return '';
}

function route(fromCity: string, toCity: string): string {
  return `${fromCity || '-'} -> ${toCity || '-'}`;
}

export function formatTripRecord(record: Record<string, unknown> = demoTrip) {
  const fromCity = text(record.fromCity, demoTrip.fromCity);
  const toCity = text(record.toCity, demoTrip.toCity);
  const categories = Array.isArray(record.acceptableCategories)
    ? record.acceptableCategories.map((item) => getCategoryLabel(String(item)))
    : demoTrip.categories;

  return {
    id: getId(record, demoTrip.id),
    route: route(fromCity, toCity),
    fromCity,
    toCity,
    departureDate: formatDate(record.departureTime || record.departureDate || demoTrip.departureDate),
    arrivalDate: formatDate(record.arrivalTime || record.arrivalDate || demoTrip.arrivalDate),
    flightNo: text(record.flightNo, demoTrip.flightNo),
    capacityKg: Number(record.luggageCapacityKg || record.capacityKg || demoTrip.capacityKg),
    categories,
    status: text(record.status, 'active'),
    verificationStatus: text(record.verificationStatus, 'pending'),
  };
}

export function formatRequestRecord(record: Record<string, unknown> = demoRequest) {
  const pickupCity = city(record.pickupLocation) || text(record.pickupCity, '上海');
  const deliveryCity = city(record.deliveryLocation) || text(record.deliveryCity, '墨尔本');
  const riskFlags = Array.isArray(record.riskFlags) ? record.riskFlags.map(String) : demoRequest.riskFlags;
  const itemPhotos = Array.isArray(record.itemPhotos) ? record.itemPhotos.map(String) : [];

  return {
    id: getId(record, demoRequest.id),
    route: route(pickupCity, deliveryCity),
    itemName: text(record.itemName, demoRequest.itemName),
    categoryLabel: getCategoryLabel(text(record.category, demoRequest.categoryLabel)),
    declaredValue: Number(record.declaredValue || demoRequest.declaredValue),
    estimatedWeightKg: Number(record.estimatedWeightKg || demoRequest.estimatedWeightKg),
    deadline: formatDate(record.deadline || demoRequest.deadline),
    reviewStatus: text(record.reviewStatus, demoRequest.reviewStatus),
    itemPhotos,
    riskFlags,
  };
}

export function formatOfferRecord(record: Record<string, unknown> = demoOffer) {
  return {
    id: getId(record, demoOffer.id),
    requestId: text(record.requestId, demoOffer.requestId),
    tripId: text(record.tripId, demoOffer.tripId),
    travellerName: text(record.travellerName, demoOffer.travellerName),
    serviceFeeQuote: Number(record.serviceFeeQuote || demoOffer.serviceFeeQuote),
    conditions: text(record.conditions, demoOffer.conditions),
    status: text(record.status, demoOffer.status),
  };
}

export function formatOrderRecord(record: Record<string, unknown> = demoOrder): MockOrder & { statusLabel: string; totalText: string } {
  const status = text(record.status, demoOrder.status) as OrderStatus;
  const feeBreakdown = (record.feeBreakdown as MockOrder['feeBreakdown']) || demoOrder.feeBreakdown;
  const pickupCity = text(record.handoverCity, city(record.pickupLocation) || demoOrder.handoverCity);
  const deliveryCity = text(record.deliveryCity, city(record.deliveryLocation) || demoOrder.deliveryCity);

  return {
    id: getId(record, demoOrder.id),
    route: text(record.route, route(pickupCity, deliveryCity)),
    itemName: text(record.itemName, demoOrder.itemName),
    categoryLabel: text(record.categoryLabel, demoOrder.categoryLabel),
    travellerName: text(record.travellerName, demoOrder.travellerName),
    requesterName: text(record.requesterName, demoOrder.requesterName),
    status,
    feeBreakdown,
    taxRule: typeof record.taxRule === 'string' ? record.taxRule : text((record.taxRule as { note?: string })?.note, demoOrder.taxRule),
    handoverCity: pickupCity,
    deliveryCity,
    evidenceCount: Number(record.evidenceCount || demoOrder.evidenceCount),
    statusLabel: orderStatusLabels[status],
    totalText: formatMoney(feeBreakdown.total),
  };
}
