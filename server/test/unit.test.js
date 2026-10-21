import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentStep } from '../src/jobs/reminders.js';
import { fromSurepass, inferVehicleType } from '../src/rc/normalize.js';
import { SAMPLES } from '../src/rc/providers/mockSamples.js';
import { docsFromNormalized } from '../src/utils/docsFromRc.js';
import { insuranceEnd, parseLooseDate, pucEnd } from '../src/utils/dates.js';
import { buildVars, renderTemplate, waNumber } from '../src/utils/messages.js';
import { displayRegNo, normalizeRegNo } from '../src/utils/regno.js';

test('reg no normalisation', () => {
  assert.equal(normalizeRegNo('mh 8 ab 1234').regNo, 'MH08AB1234');
  assert.equal(normalizeRegNo('MH-12-EF-9').regNo, 'MH12EF0009');
  assert.equal(normalizeRegNo('DL3CAB1234').regNo, 'DL03CAB1234');
  assert.equal(normalizeRegNo('22BH1234AB').ok, true);
  assert.equal(normalizeRegNo('XX08AB1234').error, 'state');
  assert.equal(normalizeRegNo('MH08AB').ok, false);
  assert.equal(displayRegNo('MH08AB1234'), 'MH 08 AB 1234');
});

test('auto end dates', () => {
  assert.equal(insuranceEnd(new Date('2025-03-15')).toISOString().slice(0, 10), '2026-03-14');
  assert.equal(pucEnd(new Date('2025-01-10'), { fuel: 'PETROL', norms: 'BHARAT STAGE VI' }).toISOString().slice(0, 10), '2026-01-09');
  assert.equal(pucEnd(new Date('2025-01-10'), { fuel: 'CNG', norms: 'BHARAT STAGE VI' }).toISOString().slice(0, 10), '2025-07-09');
  assert.equal(parseLooseDate('14-Mar-2025').toISOString().slice(0, 10), '2025-03-14');
  assert.equal(parseLooseDate('14/03/2025').toISOString().slice(0, 10), '2025-03-14');
});

test('surepass mapping: private car', () => {
  const n = fromSurepass(SAMPLES.MH08AB1234());
  assert.equal(n.ownerName, 'SANTOSH RAMCHANDRA PATIL');
  assert.equal(n.vehicleType, 'car');
  assert.equal(n.financer, 'HDFC BANK LTD');
  assert.equal(n.fitnessExpiry, null, 'private car has no fitness certificate');
  assert.ok(n.rcValidUpto, 'fit_up_to becomes RC validity');
  assert.equal(n.taxLifetime, true);
  const types = docsFromNormalized(n).map((d) => d.type).sort();
  assert.deepEqual(types, ['insurance', 'puc', 'rc']);
});

test('surepass mapping: tipper gets fitness, permit, tax', () => {
  const n = fromSurepass(SAMPLES.MH09CD5678());
  assert.equal(n.vehicleType, 'dumper');
  const types = docsFromNormalized(n).map((d) => d.type).sort();
  assert.deepEqual(types, ['fitness', 'insurance', 'permit', 'puc', 'road_tax']);
});

test('blacklist detection', () => {
  assert.equal(fromSurepass(SAMPLES.MH14JK7890()).blacklisted, true);
  assert.equal(fromSurepass(SAMPLES.MH08AB1234()).blacklisted, false);
});

test('vehicle type inference', () => {
  assert.equal(inferVehicleType({ vehicleClass: 'M-Cycle/Scooter(2WN)' }), '2W');
  assert.equal(inferVehicleType({ vehicleClass: 'Goods Carrier(LGV)', model: 'BOLERO PIK-UP' }), 'pickup');
  assert.equal(inferVehicleType({ vehicleClass: 'Construction Equipment Vehicle(CEV)' }), 'jcb');
  assert.equal(inferVehicleType({ vehicleClass: 'Agricultural Tractor(AGRI)' }), 'tractor');
});

test('reminder step selection', () => {
  const o = [-1, 1, 3, 7, 15, 30];
  assert.equal(currentStep(o, 30), 30);
  assert.equal(currentStep(o, 20), 30);
  assert.equal(currentStep(o, 5), 7);
  assert.equal(currentStep(o, 0), 1);
  assert.equal(currentStep(o, -5), -1);
  assert.equal(currentStep(o, 45), null);
});

test('message rendering and wa.me number', () => {
  const vars = buildVars({
    customer: { name: 'Santosh' }, vehicle: { regNo: 'MH08AB1234' }, doc: { type: 'puc', expiryDate: new Date('2026-10-25T00:00:00Z') },
    agent: { name: 'Gaurav', mobile: '9999999999' }, language: 'mr',
  });
  assert.equal(renderTemplate('{name} {vehicle} {doc} {expiry} {unknown}', vars), 'Santosh MH 08 AB 1234 पीयूसी 25-10-2026 {unknown}');
  assert.equal(waNumber('98220 12345'), '919822012345');
  assert.equal(waNumber('+91 98220 12345'), '919822012345');
});
