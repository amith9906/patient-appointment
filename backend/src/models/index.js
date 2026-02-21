const sequelize = require('../config/database');
const User = require('./User');
const Hospital = require('./Hospital');
const HospitalSettings = require('./HospitalSettings');
const Department = require('./Department');
const Doctor = require('./Doctor');
const Patient = require('./Patient');
const Appointment = require('./Appointment');
const Vitals = require('./Vitals');
const Medication = require('./Medication');
const Prescription = require('./Prescription');
const Lab = require('./Lab');
const LabTest = require('./LabTest');
const Report = require('./Report');
const PasswordOtp = require('./PasswordOtp');
const BillItem = require('./BillItem');
const Expense = require('./Expense');
const MedicineInvoice = require('./MedicineInvoice');
const MedicineInvoiceItem = require('./MedicineInvoiceItem');
const Vendor = require('./Vendor');
const StockPurchase = require('./StockPurchase');
const MedicineInvoiceReturn = require('./MedicineInvoiceReturn');
const MedicineInvoiceReturnItem = require('./MedicineInvoiceReturnItem');
const StockPurchaseReturn = require('./StockPurchaseReturn');
const CorporateAccount = require('./CorporateAccount');
const CorporateLedgerEntry = require('./CorporateLedgerEntry');
const MedicationBatch = require('./MedicationBatch');
const StockLedgerEntry = require('./StockLedgerEntry');
const PackagePlan = require('./PackagePlan');
const PatientPackage = require('./PatientPackage');

// Hospital -> HospitalSettings (one-to-one)
Hospital.hasOne(HospitalSettings, { foreignKey: 'hospitalId', as: 'settings' });
HospitalSettings.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Hospital -> Department (one-to-many)
Hospital.hasMany(Department, { foreignKey: 'hospitalId', as: 'departments' });
Department.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Hospital -> Doctor (one-to-many)
Hospital.hasMany(Doctor, { foreignKey: 'hospitalId', as: 'doctors' });
Doctor.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Department -> Doctor (one-to-many)
Department.hasMany(Doctor, { foreignKey: 'departmentId', as: 'doctors' });
Doctor.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });

// User -> Doctor (one-to-one)
User.hasOne(Doctor, { foreignKey: 'userId', as: 'doctorProfile' });
Doctor.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Doctor -> Appointment (one-to-many)
Doctor.hasMany(Appointment, { foreignKey: 'doctorId', as: 'appointments' });
Appointment.belongsTo(Doctor, { foreignKey: 'doctorId', as: 'doctor' });

// Patient -> Appointment (one-to-many)
Patient.hasMany(Appointment, { foreignKey: 'patientId', as: 'appointments' });
Appointment.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

// Hospital -> Lab (one-to-many)
Hospital.hasMany(Lab, { foreignKey: 'hospitalId', as: 'labs' });
Lab.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Appointment -> LabTest (one-to-many)
Appointment.hasMany(LabTest, { foreignKey: 'appointmentId', as: 'labTests' });
LabTest.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

// Patient -> LabTest (one-to-many)
Patient.hasMany(LabTest, { foreignKey: 'patientId', as: 'labTests' });
LabTest.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

// Lab -> LabTest (one-to-many)
Lab.hasMany(LabTest, { foreignKey: 'labId', as: 'tests' });
LabTest.belongsTo(Lab, { foreignKey: 'labId', as: 'lab' });

// Appointment -> Vitals (one-to-one)
Appointment.hasOne(Vitals, { foreignKey: 'appointmentId', as: 'vitals' });
Vitals.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

// Appointment -> Prescription (one-to-many)
Appointment.hasMany(Prescription, { foreignKey: 'appointmentId', as: 'prescriptions' });
Prescription.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

// Prescription -> Medication (many-to-one)
Medication.hasMany(Prescription, { foreignKey: 'medicationId', as: 'prescriptions' });
Prescription.belongsTo(Medication, { foreignKey: 'medicationId', as: 'medication' });

// Patient -> Report (one-to-many)
Patient.hasMany(Report, { foreignKey: 'patientId', as: 'reports' });
Report.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

// Appointment -> Report (one-to-many)
Appointment.hasMany(Report, { foreignKey: 'appointmentId', as: 'reports' });
Report.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

// Hospital -> Patient (one-to-many)
Hospital.hasMany(Patient, { foreignKey: 'hospitalId', as: 'patients' });
Patient.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Hospital -> Medication (one-to-many)
Hospital.hasMany(Medication, { foreignKey: 'hospitalId', as: 'medications' });
Medication.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Hospital -> User (one-to-many)
Hospital.hasMany(User, { foreignKey: 'hospitalId', as: 'users' });
User.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// User -> PasswordOtp (one-to-many)
User.hasMany(PasswordOtp, { foreignKey: 'userId', as: 'passwordOtps' });
PasswordOtp.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Appointment -> BillItem (one-to-many)
Appointment.hasMany(BillItem, { foreignKey: 'appointmentId', as: 'billItems' });
BillItem.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

// Hospital -> MedicineInvoice (one-to-many)
Hospital.hasMany(MedicineInvoice, { foreignKey: 'hospitalId', as: 'medicineInvoices' });
MedicineInvoice.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Patient -> MedicineInvoice (one-to-many)
Patient.hasMany(MedicineInvoice, { foreignKey: 'patientId', as: 'medicineInvoices' });
MedicineInvoice.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

// User -> MedicineInvoice (one-to-many) as seller
User.hasMany(MedicineInvoice, { foreignKey: 'soldByUserId', as: 'soldMedicineInvoices' });
MedicineInvoice.belongsTo(User, { foreignKey: 'soldByUserId', as: 'soldBy' });

// MedicineInvoice -> MedicineInvoiceItem (one-to-many)
MedicineInvoice.hasMany(MedicineInvoiceItem, { foreignKey: 'invoiceId', as: 'items' });
MedicineInvoiceItem.belongsTo(MedicineInvoice, { foreignKey: 'invoiceId', as: 'invoice' });

// Medication -> MedicineInvoiceItem (one-to-many)
Medication.hasMany(MedicineInvoiceItem, { foreignKey: 'medicationId', as: 'invoiceItems' });
MedicineInvoiceItem.belongsTo(Medication, { foreignKey: 'medicationId', as: 'medication' });

// MedicineInvoice -> MedicineInvoiceReturn (one-to-many)
MedicineInvoice.hasMany(MedicineInvoiceReturn, { foreignKey: 'invoiceId', as: 'returns' });
MedicineInvoiceReturn.belongsTo(MedicineInvoice, { foreignKey: 'invoiceId', as: 'invoice' });

// MedicineInvoiceReturn -> MedicineInvoiceReturnItem (one-to-many)
MedicineInvoiceReturn.hasMany(MedicineInvoiceReturnItem, { foreignKey: 'returnId', as: 'items' });
MedicineInvoiceReturnItem.belongsTo(MedicineInvoiceReturn, { foreignKey: 'returnId', as: 'return' });

// MedicineInvoiceItem -> MedicineInvoiceReturnItem (one-to-many)
MedicineInvoiceItem.hasMany(MedicineInvoiceReturnItem, { foreignKey: 'invoiceItemId', as: 'returnItems' });
MedicineInvoiceReturnItem.belongsTo(MedicineInvoiceItem, { foreignKey: 'invoiceItemId', as: 'invoiceItem' });

// Medication -> MedicineInvoiceReturnItem (one-to-many)
Medication.hasMany(MedicineInvoiceReturnItem, { foreignKey: 'medicationId', as: 'invoiceReturnItems' });
MedicineInvoiceReturnItem.belongsTo(Medication, { foreignKey: 'medicationId', as: 'medication' });

// Hospital -> MedicineInvoiceReturn (one-to-many)
Hospital.hasMany(MedicineInvoiceReturn, { foreignKey: 'hospitalId', as: 'medicineInvoiceReturns' });
MedicineInvoiceReturn.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// User -> MedicineInvoiceReturn (one-to-many)
User.hasMany(MedicineInvoiceReturn, { foreignKey: 'createdByUserId', as: 'createdMedicineInvoiceReturns' });
MedicineInvoiceReturn.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });

// Hospital -> Expense (one-to-many)
Hospital.hasMany(Expense, { foreignKey: 'hospitalId', as: 'expenses' });
Expense.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Hospital -> Vendor (one-to-many)
Hospital.hasMany(Vendor, { foreignKey: 'hospitalId', as: 'vendors' });
Vendor.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Hospital -> CorporateAccount (one-to-many)
Hospital.hasMany(CorporateAccount, { foreignKey: 'hospitalId', as: 'corporateAccounts' });
CorporateAccount.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// CorporateAccount -> Appointment (one-to-many)
CorporateAccount.hasMany(Appointment, { foreignKey: 'corporateAccountId', as: 'appointments' });
Appointment.belongsTo(CorporateAccount, { foreignKey: 'corporateAccountId', as: 'corporateAccount' });

// CorporateAccount -> CorporateLedgerEntry (one-to-many)
CorporateAccount.hasMany(CorporateLedgerEntry, { foreignKey: 'corporateAccountId', as: 'ledgerEntries' });
CorporateLedgerEntry.belongsTo(CorporateAccount, { foreignKey: 'corporateAccountId', as: 'corporateAccount' });

// Hospital -> CorporateLedgerEntry (one-to-many)
Hospital.hasMany(CorporateLedgerEntry, { foreignKey: 'hospitalId', as: 'corporateLedgerEntries' });
CorporateLedgerEntry.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Appointment -> CorporateLedgerEntry (one-to-many)
Appointment.hasMany(CorporateLedgerEntry, { foreignKey: 'appointmentId', as: 'corporateLedgerEntries' });
CorporateLedgerEntry.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

// User -> CorporateLedgerEntry (one-to-many)
User.hasMany(CorporateLedgerEntry, { foreignKey: 'createdByUserId', as: 'createdCorporateLedgerEntries' });
CorporateLedgerEntry.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });

// Hospital -> StockPurchase (one-to-many)
Hospital.hasMany(StockPurchase, { foreignKey: 'hospitalId', as: 'stockPurchases' });
StockPurchase.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Vendor -> StockPurchase (one-to-many)
Vendor.hasMany(StockPurchase, { foreignKey: 'vendorId', as: 'purchases' });
StockPurchase.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

// Medication -> StockPurchase (one-to-many)
Medication.hasMany(StockPurchase, { foreignKey: 'medicationId', as: 'stockPurchases' });
StockPurchase.belongsTo(Medication, { foreignKey: 'medicationId', as: 'medication' });

// Hospital -> MedicationBatch (one-to-many)
Hospital.hasMany(MedicationBatch, { foreignKey: 'hospitalId', as: 'medicationBatches' });
MedicationBatch.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Medication -> MedicationBatch (one-to-many)
Medication.hasMany(MedicationBatch, { foreignKey: 'medicationId', as: 'batches' });
MedicationBatch.belongsTo(Medication, { foreignKey: 'medicationId', as: 'medication' });

// Hospital -> StockLedgerEntry (one-to-many)
Hospital.hasMany(StockLedgerEntry, { foreignKey: 'hospitalId', as: 'stockLedgerEntries' });
StockLedgerEntry.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Medication -> StockLedgerEntry (one-to-many)
Medication.hasMany(StockLedgerEntry, { foreignKey: 'medicationId', as: 'stockLedgerEntries' });
StockLedgerEntry.belongsTo(Medication, { foreignKey: 'medicationId', as: 'medication' });

// MedicationBatch -> StockLedgerEntry (one-to-many)
MedicationBatch.hasMany(StockLedgerEntry, { foreignKey: 'batchId', as: 'ledgerEntries' });
StockLedgerEntry.belongsTo(MedicationBatch, { foreignKey: 'batchId', as: 'batch' });

// User -> StockLedgerEntry (one-to-many)
User.hasMany(StockLedgerEntry, { foreignKey: 'createdByUserId', as: 'createdStockLedgerEntries' });
StockLedgerEntry.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });

// User -> StockPurchase (one-to-many)
User.hasMany(StockPurchase, { foreignKey: 'createdByUserId', as: 'createdStockPurchases' });
StockPurchase.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });

// StockPurchase -> StockPurchaseReturn (one-to-many)
StockPurchase.hasMany(StockPurchaseReturn, { foreignKey: 'stockPurchaseId', as: 'returns' });
StockPurchaseReturn.belongsTo(StockPurchase, { foreignKey: 'stockPurchaseId', as: 'purchase' });

// Medication -> StockPurchaseReturn (one-to-many)
Medication.hasMany(StockPurchaseReturn, { foreignKey: 'medicationId', as: 'stockPurchaseReturns' });
StockPurchaseReturn.belongsTo(Medication, { foreignKey: 'medicationId', as: 'medication' });

// Vendor -> StockPurchaseReturn (one-to-many)
Vendor.hasMany(StockPurchaseReturn, { foreignKey: 'vendorId', as: 'purchaseReturns' });
StockPurchaseReturn.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

// Hospital -> StockPurchaseReturn (one-to-many)
Hospital.hasMany(StockPurchaseReturn, { foreignKey: 'hospitalId', as: 'stockPurchaseReturns' });
StockPurchaseReturn.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// User -> StockPurchaseReturn (one-to-many)
User.hasMany(StockPurchaseReturn, { foreignKey: 'createdByUserId', as: 'createdStockPurchaseReturns' });
StockPurchaseReturn.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });

// Hospital -> PackagePlan (one-to-many)
Hospital.hasMany(PackagePlan, { foreignKey: 'hospitalId', as: 'packagePlans' });
PackagePlan.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Hospital -> PatientPackage (one-to-many)
Hospital.hasMany(PatientPackage, { foreignKey: 'hospitalId', as: 'patientPackages' });
PatientPackage.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });

// Patient -> PatientPackage (one-to-many)
Patient.hasMany(PatientPackage, { foreignKey: 'patientId', as: 'packages' });
PatientPackage.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

// PackagePlan -> PatientPackage (one-to-many)
PackagePlan.hasMany(PatientPackage, { foreignKey: 'packagePlanId', as: 'assignments' });
PatientPackage.belongsTo(PackagePlan, { foreignKey: 'packagePlanId', as: 'plan' });

// User -> PatientPackage (one-to-many)
User.hasMany(PatientPackage, { foreignKey: 'createdByUserId', as: 'createdPatientPackages' });
PatientPackage.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });

module.exports = {
  sequelize,
  User,
  Hospital,
  HospitalSettings,
  Department,
  Doctor,
  Patient,
  Appointment,
  Vitals,
  Medication,
  Prescription,
  Lab,
  LabTest,
  Report,
  PasswordOtp,
  BillItem,
  Expense,
  MedicineInvoice,
  MedicineInvoiceItem,
  Vendor,
  StockPurchase,
  MedicineInvoiceReturn,
  MedicineInvoiceReturnItem,
  StockPurchaseReturn,
  CorporateAccount,
  CorporateLedgerEntry,
  MedicationBatch,
  StockLedgerEntry,
  PackagePlan,
  PatientPackage,
};
