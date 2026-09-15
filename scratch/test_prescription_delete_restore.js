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

async function testPrescriptionDeleteRestore() {
  try {
    const user = await User.findOne();
    const hospital = await Hospital.findOne() || await Hospital.create({ name: 'Test Hospital' });
    let med = await Medication.findOne({ where: { name: 'Batch Restore Test Med' } });
    if (!med) {
      med = await Medication.create({
        name: 'Batch Restore Test Med',
        stockQuantity: 20,
        unitPrice: 15.00,
        hospitalId: hospital.id,
      });
    } else {
      await med.update({ stockQuantity: 20 });
    }

    // Create a batch for this medication
    let batch = await MedicationBatch.findOne({ where: { medicationId: med.id, batchNo: 'TEST-BATCH-001' } });
    if (!batch) {
      batch = await MedicationBatch.create({
        hospitalId: hospital.id,
        medicationId: med.id,
        batchNo: 'TEST-BATCH-001',
        expiryDate: '2028-12-31',
        quantityOnHand: 20,
        unitCost: 10.00,
        isActive: true,
      });
    } else {
      await batch.update({ quantityOnHand: 20, expiryDate: '2028-12-31' });
    }

    // Clean old ledger entries for this med
    await StockLedgerEntry.destroy({ where: { medicationId: med.id } });

    console.log('=== BEFORE DISPENSING ===');
    console.log(`Medication stockQuantity: ${med.stockQuantity}`);
    console.log(`Batch quantityOnHand: ${batch.quantityOnHand}`);

    // 1. Dispense Prescription (Qty: 5)
    let appt = await Appointment.findOne();
    const reqCreate = {
      user: { id: user ? user.id : hospital.id },
      body: {
        appointmentId: appt ? appt.id : null,
        medicationId: med.id,
        quantity: 5,
        dosage: '1 tablet daily',
        frequency: 'OD',
        duration: '5 days',
      },
    };
    const resCreate = createMockRes();
    await prescriptionController.create(reqCreate, resCreate);

    console.log('\n=== AFTER DISPENSING (QTY: 5) ===');
    const prescriptionId = resCreate.body?.id;
    console.log(`Created Prescription ID: ${prescriptionId}`);

    const medAfterDispense = await Medication.findByPk(med.id);
    const batchAfterDispense = await MedicationBatch.findByPk(batch.id);
    const saleLedger = await StockLedgerEntry.findOne({ where: { referenceId: prescriptionId, entryType: 'sale' } });

    console.log(`Medication stockQuantity: ${medAfterDispense.stockQuantity}`);
    console.log(`Batch quantityOnHand: ${batchAfterDispense.quantityOnHand}`);
    console.log('Dispense StockLedgerEntry:', JSON.stringify(saleLedger?.toJSON(), null, 2));

    // 2. Delete Prescription (Restore Qty: 5)
    console.log('\n=== DELETING PRESCRIPTION (RESTORING STOCK) ===');
    const reqDelete = {
      params: { id: prescriptionId },
      user: { id: user ? user.id : hospital.id },
    };
    const resDelete = createMockRes();
    await prescriptionController.delete(reqDelete, resDelete);

    console.log(`Delete Response Status: ${resDelete.statusCode}`);
    console.log('Delete Response Body:', resDelete.body);

    const medAfterDelete = await Medication.findByPk(med.id);
    const batchAfterDelete = await MedicationBatch.findByPk(batch.id);
    const restoreLedger = await StockLedgerEntry.findOne({ where: { referenceId: prescriptionId, entryType: 'sales_return' } });

    console.log('\n=== AFTER DELETION / RESTORATION ===');
    console.log(`Medication stockQuantity restored to: ${medAfterDelete.stockQuantity}`);
    console.log(`Batch quantityOnHand restored to: ${batchAfterDelete.quantityOnHand}`);
    console.log('Restoration StockLedgerEntry (sales_return):', JSON.stringify(restoreLedger?.toJSON(), null, 2));

    // Clean test data
    await StockLedgerEntry.destroy({ where: { medicationId: med.id } });
    await batch.destroy();
    await med.destroy();

    process.exit(0);
  } catch (err) {
    console.error('Error during test:', err);
    process.exit(1);
  }
}

testPrescriptionDeleteRestore();
