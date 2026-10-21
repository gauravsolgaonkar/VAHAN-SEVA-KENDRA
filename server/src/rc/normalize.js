import { parseLooseDate } from '../utils/dates.js';

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const str = (v) => (v === null || v === undefined ? null : String(v).trim() || null);

/** Best guess of our vehicle type from VAHAN class/category/body text. */
export function inferVehicleType({ vehicleClass = '', vehicleCategory = '', bodyType = '', model = '' }) {
  const t = `${vehicleClass} ${vehicleCategory} ${bodyType} ${model}`.toUpperCase();
  if (/EXCAVATOR|LOADER|BACKHOE|JCB|CONSTRUCTION|CRANE|ROAD ROLLER/.test(t)) return 'jcb';
  if (/TRACTOR|AGRICULTUR/.test(t)) return 'tractor';
  if (/DUMPER|TIPPER/.test(t)) return 'dumper';
  if (/BUS|OMNI|SCHOOL/.test(t)) return 'bus';
  if (/M-CYCLE|SCOOTER|MOPED|2W|MOTOR CYCLE|TWO WHEELER/.test(t)) return '2W';
  if (/3W|E-RICKSHAW|THREE WHEELER|AUTO RICKSHAW/.test(t)) return 'auto';
  if (/HGV|HEAVY GOODS|HPV|TRUCK|TRAILER|TANKER/.test(t)) return 'truck';
  if (/LGV|PICK ?UP|GOODS CARRIER|LIGHT GOODS|BOLERO MAXI/.test(t)) return 'pickup';
  if (/LMV|MOTOR CAR|CAR|SUV|JEEP|MAXI CAB|MOTOR CAB/.test(t)) return 'car';
  return 'other';
}

/** Transport (commercial) categories need fitness certificates and permits. */
export function isTransport(category = '') {
  return !/^(LMV|2WN|2WIC|3WN|AGRI|TRCTR|CEV|INV CARR)$/i.test(String(category || '').trim());
}

function finish(n) {
  n.vehicleType = inferVehicleType(n);
  n.blacklisted = /BLACKLIST/i.test(n.blacklistStatus || '') && !/^(NA|NO|NONE)$/i.test(n.blacklistStatus || '');
  return n;
}

/** Surepass `rc-full` data object -> our normalized shape. */
export function fromSurepass(d) {
  const mfg = parseLooseDate(d.manufacturing_date_formatted || d.manufacturing_date);
  return finish({
    regNo: str(d.rc_number),
    ownerName: str(d.owner_name),
    fatherName: str(d.father_name),
    presentAddress: str(d.present_address),
    permanentAddress: str(d.permanent_address),
    mobileMasked: str(d.mobile_number),
    maker: str(d.maker_description),
    model: str(d.maker_model),
    variant: str(d.variant),
    bodyType: str(d.body_type),
    vehicleClass: str(d.vehicle_category_description),
    vehicleCategory: str(d.vehicle_category),
    fuel: str(d.fuel_type),
    norms: str(d.norms_type),
    colour: str(d.color),
    seatingCapacity: num(d.seat_capacity),
    cubicCapacity: num(d.cubic_capacity),
    grossWeight: num(d.vehicle_gross_weight),
    unladenWeight: num(d.unladen_weight),
    manufacturingYear: mfg ? mfg.getUTCFullYear() : null,
    registrationDate: parseLooseDate(d.registration_date),
    // Private (non-transport) vehicles: "fit up to" is the registration validity, not a fitness certificate.
    rcValidUpto: parseLooseDate(d.rc_expiry_date) || (isTransport(d.vehicle_category) ? null : parseLooseDate(d.fit_up_to)),
    chassisNo: str(d.vehicle_chasi_number),
    engineNo: str(d.vehicle_engine_number),
    rto: str(d.registered_at),
    financer: d.financed ? str(d.financer) : null,
    insurance: {
      company: str(d.insurance_company),
      policyNo: str(d.insurance_policy_number),
      expiry: parseLooseDate(d.insurance_upto),
    },
    puc: { number: str(d.pucc_number), expiry: parseLooseDate(d.pucc_upto) },
    fitnessExpiry: isTransport(d.vehicle_category) ? parseLooseDate(d.fit_up_to) : null,
    permit: {
      number: str(d.permit_number),
      type: str(d.permit_type),
      validFrom: parseLooseDate(d.permit_valid_from),
      expiry: parseLooseDate(d.permit_valid_upto),
    },
    nationalPermit: { number: str(d.national_permit_number), expiry: parseLooseDate(d.national_permit_upto) },
    taxPaidUpto: d.tax_paid_upto === 'LTT' ? null : parseLooseDate(d.tax_paid_upto || d.tax_upto),
    taxLifetime: d.tax_paid_upto === 'LTT' || d.tax_upto === 'LTT',
    rcStatus: str(d.rc_status),
    blacklistStatus: str(d.blacklist_status),
  });
}

/** Cashfree vehicle RC verification response -> normalized. */
export function fromCashfree(d) {
  const mfg = parseLooseDate(d.vehicle_manufacturing_month_year);
  return finish({
    regNo: str(d.reg_no),
    ownerName: str(d.owner),
    fatherName: str(d.owner_father_name),
    presentAddress: str(d.present_address),
    permanentAddress: str(d.permanent_address),
    mobileMasked: str(d.mobile_number),
    maker: str(d.vehicle_manufacturer_name),
    model: str(d.model),
    variant: null,
    bodyType: str(d.body_type),
    vehicleClass: str(d.class),
    vehicleCategory: str(d.vehicle_category),
    fuel: str(d.type),
    norms: str(d.norms_type),
    colour: str(d.vehicle_colour),
    seatingCapacity: num(d.vehicle_seat_capacity),
    cubicCapacity: num(d.vehicle_cubic_capacity),
    grossWeight: num(d.gross_vehicle_weight),
    unladenWeight: num(d.unladen_weight),
    manufacturingYear: mfg ? mfg.getUTCFullYear() : null,
    registrationDate: parseLooseDate(d.reg_date),
    rcValidUpto: parseLooseDate(d.rc_expiry_date),
    chassisNo: str(d.chassis),
    engineNo: str(d.engine),
    rto: str(d.reg_authority),
    financer: str(d.rc_financer),
    insurance: {
      company: str(d.vehicle_insurance_company_name),
      policyNo: str(d.vehicle_insurance_policy_number),
      expiry: parseLooseDate(d.vehicle_insurance_upto),
    },
    puc: { number: str(d.pucc_number), expiry: parseLooseDate(d.pucc_upto) },
    fitnessExpiry: parseLooseDate(d.fit_up_to),
    permit: { number: str(d.permit_number), type: str(d.permit_type), validFrom: parseLooseDate(d.permit_valid_from), expiry: parseLooseDate(d.permit_valid_upto) },
    nationalPermit: { number: str(d.national_permit_number), expiry: parseLooseDate(d.national_permit_upto) },
    taxPaidUpto: parseLooseDate(d.vehicle_tax_upto),
    taxLifetime: /LTT|LIFE/i.test(d.vehicle_tax_upto || ''),
    rcStatus: str(d.status || d.rc_status),
    blacklistStatus: str(d.blacklist_status),
  });
}
