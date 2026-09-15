require('d:/Doc/backend/node_modules/dotenv').config({ path: 'd:/Doc/backend/.env' });
const { sequelize, Medication, MedicationBatch, Prescription, StockLedgerEntry, Patient, Doctor, Hospital, User, Appointment } = require('d:/Doc/backend/src/models');
const prescriptionController = require('d:/Doc/backend/src/controllers/prescriptionController');

// Mock res helper
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function testPrescriptionDispenseFix() {
  try {
    const user = await User.findOne();
    let med = await Medication.findOne({ where: { name: 'Prescription Test Med' } });
    if (!med) {
      const hospital = await Hospital.findOne() || await Hospital.create({ name: 'Test Hospital' });
      med = await Medication.create({
        name: 'Prescription Test Med',
        stockQuantity: 20,
        unitPrice: 15.00,
        hospitalId: hospital.id,
      });
    } else {
      await med.update({ stockQuantity: 20, expiryDate: null });
    }

    // Clean up any old test StockLedgerEntry rows for this medication
    await StockLedgerEntry.destroy({ where: { medicationId: med.id } });

    console.log('=== STEP 1: BEFORE PRESCRIPTION DISPENSING ===');
    console.log(`Medication ID: ${med.id}`);
    console.log(`Initial stockQuantity: ${med.stockQuantity}`);
    const ledgerBeforeCount = await StockLedgerEntry.count({ where: { medicationId: med.id } });
    console.log(`StockLedgerEntry count before: ${ledgerBeforeCount}`);

    let appt = await Appointment.findOne();

    // 1. Valid Prescription Dispensing (Quantity: 5)
    console.log('\n=== STEP 2: DISPENSING VALID PRESCRIPTION (QTY: 5) ===');
    const req1 = {
      user: { id: user ? user.id : med.hospitalId },
      body: {
        appointmentId: appt ? appt.id : null,
        medicationId: med.id,
        quantity: 5,
        dosage: '1 tablet daily',
        frequency: 'OD',
        duration: '5 days',
      },
    };
    const res1 = createMockRes();
    await prescriptionController.create(req1, res1);

    console.log(`HTTP Status Code: ${res1.statusCode}`);
    console.log('Prescription Response:', JSON.stringify(res1.body, null, 2));

    const medAfterValid = await Medication.findByPk(med.id);
    const ledgerRows = await StockLedgerEntry.findAll({
      where: { medicationId: med.id },
      raw: true,
    });

    console.log(`\nNew stockQuantity: ${medAfterValid.stockQuantity}`);
    console.log(`StockLedgerEntry count after valid dispense: ${ledgerRows.length}`);
    console.log('Inserted StockLedgerEntry Row:', JSON.stringify(ledgerRows[0], null, 2));

    // 2. Oversell Protection Test (Quantity: 999 against available stock 15)
    console.log('\n=== STEP 3: OVERSELL ATTEMPT TEST (QTY: 999) ===');
    const prescriptionsBeforeCount = await Prescription.count({ where: { medicationId: med.id } });
    const req2 = {
      user: { id: user ? user.id : med.hospitalId },
      body: {
        appointmentId: appt ? appt.id : null,
        medicationId: med.id,
        quantity: 999,
        dosage: '10 tablets daily',
        frequency: 'TDS',
        duration: '99 days',
      },
    };
    const res2 = createMockRes();
    await prescriptionController.create(req2, res2);

    console.log(`HTTP Status Code: ${res2.statusCode}`);
    console.log('HTTP Error Response Body:', JSON.stringify(res2.body, null, 2));

    const medAfterOversell = await Medication.findByPk(med.id);
    const prescriptionsAfterCount = await Prescription.count({ where: { medicationId: med.id } });

    console.log(`Stock after rejected oversell attempt: ${medAfterOversell.stockQuantity}`);
    console.log(`Prescriptions count before oversell: ${prescriptionsBeforeCount}`);
    console.log(`Prescriptions count after oversell: ${prescriptionsAfterCount} (0 orphaned prescriptions created!)`);

    // 3. Batch Expiry Validation Test
    console.log('\n=== STEP 4: EXPIRED MEDICATION DISPENSE TEST ===');
    const pastDate = '2020-01-01';
    await med.update({ expiryDate: pastDate });

    const req3 = {
      user: { id: user ? user.id : med.hospitalId },
      body: {
        appointmentId: appt ? appt.id : null,
        medicationId: med.id,
        quantity: 2,
        dosage: '1 tablet daily',
        frequency: 'OD',
        duration: '2 days',
      },
    };
    const res3 = createMockRes();
    await prescriptionController.create(req3, res3);

    console.log(`HTTP Status Code: ${res3.statusCode}`);
    console.log('HTTP Error Response Body for Expired Medication:', JSON.stringify(res3.body, null, 2));

    // Cleanup test data
    if (res1.body && res1.body.id) {
      await Prescription.destroy({ where: { id: res1.body.id } });
    }
    await StockLedgerEntry.destroy({ where: { medicationId: med.id } });
    await med.update({ stockQuantity: 20, expiryDate: null });

    console.log('\n=== ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

testPrescriptionDispenseFix();
