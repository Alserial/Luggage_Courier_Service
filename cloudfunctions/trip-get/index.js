const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function toSafeTrip(trip, isOwner) {
  const safeTrip = {
    _id: trip._id,
    fromCountry: trip.fromCountry,
    fromCity: trip.fromCity,
    fromAirportOrStation: trip.fromAirportOrStation,
    toCountry: trip.toCountry,
    toCity: trip.toCity,
    toAirportOrStation: trip.toAirportOrStation,
    departureTime: trip.departureTime,
    arrivalTime: trip.arrivalTime,
    flightNo: trip.flightNo,
    luggageCapacityKg: trip.luggageCapacityKg,
    acceptableCategories: trip.acceptableCategories || [],
    unacceptableCategories: trip.unacceptableCategories || [],
    handoverPreference: trip.handoverPreference,
    status: trip.status,
    verificationStatus: trip.verificationStatus,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    isOwner,
  };

  if (isOwner) {
    safeTrip.note = trip.note || '';
    safeTrip.verificationReason = trip.verificationReason || '';
  }

  return safeTrip;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { tripId } = event;
  if (!tripId) return { ok: false, error: 'missing_trip_id' };

  const db = cloud.database();
  let trip;
  try {
    trip = (await db.collection('trips').doc(tripId).get()).data;
  } catch (error) {
    return { ok: false, error: 'trip_not_found' };
  }

  const isOwner = trip.travellerOpenid === OPENID;
  if (trip.status === 'cancelled') return { ok: false, error: 'trip_deleted' };
  if (!isOwner && (trip.verificationStatus !== 'approved' || trip.status !== 'active')) {
    return { ok: false, error: 'permission_denied' };
  }

  return { ok: true, trip: toSafeTrip(trip, isOwner), isOwner };
};
