require('d:/Doc/backend/node_modules/dotenv').config({ path: 'd:/Doc/backend/.env' });
const { Doctor, Hospital, Patient, Appointment } = require('d:/Doc/backend/src/models');
const publicDoctorController = require('d:/Doc/backend/src/controllers/publicDoctorController');

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

async function testPublicDoctorBooking() {
  try {
    const doc = await Doctor.findOne({ where: { isActive: true }, include: [{ model: Hospital, as: 'hospital' }] });
    if (!doc || !doc.slug) {
      console.error('No doctor with slug found');
      process.exit(1);
    }

    console.log('=== TEST 1: UNAUTHENTICATED GET PUBLIC DOCTOR PROFILE ===');
    console.log(`Testing slug: ${doc.slug}`);
    
    const req1 = { params: { slug: doc.slug }, headers: {} }; // No Auth token
    const res1 = createMockRes();
    await publicDoctorController.getDoctorBySlug(req1, res1);

    console.log(`HTTP Status: ${res1.statusCode}`);
    console.log('Returned Doctor Public Profile:');
    console.log(`- Doctor Name: ${res1.body.doctor?.name}`);
    console.log(`- Specialization: ${res1.body.doctor?.specialization}`);
    console.log(`- Hospital Name: ${res1.body.doctor?.hospital?.name}`);
    console.log(`- Public Booking URL: ${res1.body.bookingUrl}`);
    console.log(`- QR Code Data URL Generated: ${Boolean(res1.body.qrCodeDataUrl)} (Length: ${res1.body.qrCodeDataUrl?.length})`);

    // Verify multi-tenant scoping
    if (res1.body.doctor?.hospital?.id !== doc.hospitalId) {
      throw new Error('Multi-tenant mismatch! Hospital ID does not match doctor hospitalId');
    }
    console.log('✅ Multi-tenant scoping confirmed: Doctor profile only displays assigned hospital.');

    console.log('\n=== TEST 2: UNAUTHENTICATED PUBLIC APPOINTMENT BOOKING ===');
    const testPatientPhone = '9876543210';
    const req2 = {
      params: { slug: doc.slug },
      body: {
        patientName: 'Test Public Patient',
        patientPhone: testPatientPhone,
        patientEmail: 'publicpatient@example.com',
        appointmentDate: '2026-09-20',
        appointmentTime: '11:00 AM',
        reason: 'Severe headache and fever',
      },
      headers: {}, // No Auth token
    };
    const res2 = createMockRes();
    await publicDoctorController.submitPublicBooking(req2, res2);

    console.log(`HTTP Status: ${res2.statusCode}`);
    console.log('Booking Response Message:', res2.body.message);
    const appt = res2.body.appointment;
    console.log(`- Created Appointment Number: ${appt?.appointmentNumber}`);
    console.log(`- Status: ${appt?.status} (Expected: pending_confirmation)`);
    console.log(`- Hospital ID: ${appt?.hospitalId} (Matches Doctor Hospital ID: ${doc.hospitalId})`);
    console.log(`- Patient Name: ${appt?.patient?.name}`);

    if (appt?.status !== 'pending_confirmation') {
      throw new Error(`Unexpected status ${appt?.status}, expected pending_confirmation`);
    }

    // Cleanup test appointment & patient
    if (appt?.id) await Appointment.destroy({ where: { id: appt.id } });
    if (appt?.patientId) await Patient.destroy({ where: { id: appt.patientId } });

    console.log('\n=== GAP 1 VERIFICATION COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

testPublicDoctorBooking();
