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
};
