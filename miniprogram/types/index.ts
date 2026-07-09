export type OrderStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'pending_payment'
  | 'paid_locked'
  | 'item_handed_to_carrier'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'cancelled'
  | 'refunded';

export type ItemCategory =
  | 'clothing'
  | 'books'
  | 'stationery'
  | 'small_gifts'
  | 'phone_accessories'
  | 'daily_items';

export interface TripDraft {
  fromCity: string;
  toCity: string;
  departureDate: string;
  arrivalDate: string;
  flightNo: string;
  luggageCapacityKg: number;
  acceptableCategories: ItemCategory[];
  note: string;
}

export interface ItemRequestDraft {
  itemName: string;
  category: ItemCategory | '';
  quantity: number;
  declaredValue: number;
  estimatedWeightKg: number;
  pickupCity: string;
  deliveryCity: string;
  deadline: string;
  note: string;
  riskDeclarationAccepted: boolean;
}

export interface MatchCandidate {
  id: string;
  tripId: string;
  requestId: string;
  route: string;
  dateWindow: string;
  categoryLabel: string;
  capacityKg: number;
  score: number;
  reasons: string[];
}

export interface OfferDraft {
  requestId: string;
  tripId: string;
  serviceFeeQuote: number;
  message: string;
  conditions: string;
}

export interface UserProfile {
  nickname: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
}
