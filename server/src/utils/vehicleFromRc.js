import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import { syncDocsFromRc } from './docsFromRc.js';

export const titleCase = (s = '') => String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** Vehicle fields from a normalized RC response. */
export function vehicleFieldsFromRc(n) {
  return {
    vehicleType: n.vehicleType, ownerName: titleCase(n.ownerName), fatherName: titleCase(n.fatherName),
    presentAddress: n.presentAddress, permanentAddress: n.permanentAddress, maker: n.maker, model: n.model, variant: n.variant,
    bodyType: n.bodyType, vehicleClass: n.vehicleClass, vehicleCategory: n.vehicleCategory, fuel: n.fuel, norms: n.norms,
    colour: n.colour, seatingCapacity: n.seatingCapacity, cubicCapacity: n.cubicCapacity, grossWeight: n.grossWeight,
    unladenWeight: n.unladenWeight, manufacturingYear: n.manufacturingYear, registrationDate: n.registrationDate,
    rcValidUpto: n.rcValidUpto, chassisNo: n.chassisNo, engineNo: n.engineNo, rto: n.rto, financer: n.financer,
    rcStatus: n.rcStatus, blacklisted: n.blacklisted,
  };
}

/**
 * Create the vehicle from an RC record (or, if it already exists, fill its blank fields) and sync documents.
 * `customer` is used for new vehicles; when omitted, a customer is found or created from the RC owner name.
 */
export async function upsertVehicleFromRc({ tenantId, agentId, record, customer }) {
  const n = record.normalized;
  let vehicle = await Vehicle.findOne({ tenantId, regNo: record.regNo });
  if (vehicle) {
    const fields = vehicleFieldsFromRc(n);
    for (const [k, v] of Object.entries(fields)) if ((vehicle[k] === undefined || vehicle[k] === null || vehicle[k] === '') && v != null) vehicle[k] = v;
    vehicle.rcStatus = n.rcStatus;
    vehicle.blacklisted = n.blacklisted;
  } else {
    if (!customer) {
      const name = titleCase(n.ownerName) || record.regNo;
      customer = await Customer.findOne({ tenantId, name }) ||
        await Customer.create({ tenantId, agentId, name, city: (n.rto || '').split(',')[0] || undefined, address: n.presentAddress });
    }
    vehicle = new Vehicle({ ...vehicleFieldsFromRc(n), tenantId, agentId: customer.agentId, customerId: customer._id, regNo: record.regNo });
  }
  vehicle.rcRecordId = record._id;
  vehicle.rcFetchedAt = record.fetchedAt;
  await vehicle.save();
  const created = await syncDocsFromRc(vehicle, n);
  return { vehicle, createdDocuments: created.length };
}
