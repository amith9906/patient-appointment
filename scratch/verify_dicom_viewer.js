const path = require('path');
const fs = require('fs');
const http = require('http');

module.paths.push(path.join(__dirname, '../backend/node_modules'));
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const jwt = require('jsonwebtoken');
const { Hospital, Patient, Report, User, StockLedgerEntry } = require('../backend/src/models');
const app = require('../backend/src/app');
const { createMinimalDicomFile } = require('./create_sample_dicom');

async function runDicomVerification() {
  console.log('=============== DICOM VIEWER & SECURITY VERIFICATION ===============\n');

  const baseUrl = `http://localhost:${process.env.PORT || 5010}`;

  try {
    // 1. Setup Test Tenant & Patients
    const hospitalA = await Hospital.create({
      name: 'DICOM Test Hospital A',
      address: '100 Scan Way',
      phone: '1113335555',
      type: 'general',
      isActive: true,
    });

    const hospitalB = await Hospital.create({
      name: 'DICOM Test Hospital B',
      address: '200 Radiology Rd',
      phone: '2224446666',
      type: 'general',
      isActive: true,
    });

    const patientA = await Patient.create({
      patientId: `P-DICOM-A-${Date.now()}`,
      name: 'Patient A (DICOM Scan Owner)',
      phone: '9770001111',
      email: 'patienta.dicom@example.com',
      hospitalId: hospitalA.id,
      isActive: true,
    });

    const patientB = await Patient.create({
      patientId: `P-DICOM-B-${Date.now()}`,
      name: 'Patient B (Unauthorised Portal User)',
      phone: '9770002222',
      email: 'patientb.dicom@example.com',
      hospitalId: hospitalB.id,
      isActive: true,
    });

    // 2. Staff User Token
    const staffUser = await User.create({
      name: 'Staff Radiologist',
      email: `rad.${Date.now()}@hospitala.com`,
      password: 'password123',
      role: 'doctor',
      hospitalId: hospitalA.id,
    });

    const staffToken = jwt.sign(
      { id: staffUser.id, role: staffUser.role, hospitalId: hospitalA.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );

    // Patient Portal Tokens
    const patientAToken = jwt.sign(
      { id: patientA.id, patientId: patientA.id, hospitalId: hospitalA.id, role: 'patient', isPatientPortal: true },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    const patientBToken = jwt.sign(
      { id: patientB.id, patientId: patientB.id, hospitalId: hospitalB.id, role: 'patient', isPatientPortal: true },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    // 3. Baseline Stock Ledger Count (No-Auto-Dispense Constraint)
    const ledgerCountBefore = await StockLedgerEntry.count();

    // 4. Ensure test DICOM file exists
    const dicomFilePath = path.join(__dirname, 'test_scan.dcm');
    if (!fs.existsSync(dicomFilePath)) {
      createMinimalDicomFile(dicomFilePath);
    }
    const fileBytes = fs.readFileSync(dicomFilePath);

    console.log('--- TEST 1: Uploading .dcm File via POST /api/reports/patient/:patientId/upload ---');
    
    // Perform multipart/form-data upload using fetch
    const FormData = require('form-data');
    const form = new FormData();
    form.append('title', 'Brain MRI Slice Series (.dcm)');
    form.append('type', 'radiology');
    form.append('description', 'Diagnostic radiology DICOM scan');
    form.append('file', fs.createReadStream(dicomFilePath), { filename: 'chest_scan.dcm', contentType: 'application/dicom' });

    const uploadRes = await new Promise((resolve, reject) => {
      const req = http.request(`${baseUrl}/api/reports/patient/${patientA.id}/upload`, {
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${staffToken}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      });
      req.on('error', reject);
      form.pipe(req);
    });

    console.log(`Upload Response Status: ${uploadRes.status}`);
    console.log(`Uploaded Report ID: ${uploadRes.data.id}`);
    console.log(`Stored MimeType: ${uploadRes.data.mimeType}`);
    console.log(`Stored OriginalName: ${uploadRes.data.originalName}`);
    
    if (uploadRes.status !== 201) {
      throw new Error(`Upload failed with status ${uploadRes.status}`);
    }
    const reportId = uploadRes.data.id;
    console.log('✅ TEST 1 PASS: DICOM file successfully accepted and stored by report upload endpoint!\n');

    // 5. TEST 2: Inline File Serving via GET /api/reports/:id/view
    console.log('--- TEST 2: Serving DICOM File Inline via GET /api/reports/:id/view ---');
    const viewRes = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/api/reports/${reportId}/view`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer: Buffer.concat(chunks)
        }));
      }).on('error', reject);
    });

    console.log(`View Response Status: ${viewRes.status}`);
    console.log(`Content-Type Header: ${viewRes.headers['content-type']}`);
    console.log(`Content-Length Header: ${viewRes.headers['content-length']}`);

    // Verify DICM Header at offset 128
    const magicHeader = viewRes.buffer.toString('ascii', 128, 132);
    console.log(`Received DICOM Magic Header at offset 128: "${magicHeader}"`);

    if (viewRes.status !== 200 || viewRes.headers['content-type'] !== 'application/dicom' || magicHeader !== 'DICM') {
      throw new Error('Inline DICOM file view test failed!');
    }
    console.log('✅ TEST 2 PASS: DICOM file served inline with correct Content-Type (application/dicom) and valid "DICM" magic header!\n');

    // 6. TEST 3: No-Auto-Dispense Safety Guard Verification
    console.log('--- TEST 3: No-Auto-Dispense Safety Guard Verification ---');
    const ledgerCountAfter = await StockLedgerEntry.count();
    console.log(`StockLedgerEntry Count Before Upload: ${ledgerCountBefore}`);
    console.log(`StockLedgerEntry Count After Upload/View: ${ledgerCountAfter}`);
    if (ledgerCountBefore !== ledgerCountAfter) {
      throw new Error('SAFETY VIOLATION: DICOM upload/view modified stock ledger!');
    }
    console.log('✅ TEST 3 PASS: No-auto-dispense constraint verified! (0 stock ledger entries created, 0 pharmacy inventory changes)\n');

    // 7. TEST 4: Patient Portal Cross-Tenant & Cross-Patient Isolation Security Test
    console.log('--- TEST 4: Patient Portal Security Test (Patient-Portal Scoping) ---');
    
    // Patient A fetching their own DICOM report via patient portal route
    console.log(`[Patient Portal] Patient A fetching own DICOM report (${reportId}) via GET /api/patient-portal/reports/${reportId}/view...`);
    const patientARes = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/api/patient-portal/reports/${reportId}/view`, {
        headers: { Authorization: `Bearer ${patientAToken}` }
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) }));
      }).on('error', reject);
    });

    console.log(`Patient A View Status: ${patientARes.status}`);
    console.log(`Patient A Content-Type: ${patientARes.headers['content-type']}`);
    if (patientARes.status !== 200 || patientARes.headers['content-type'] !== 'application/dicom') {
      throw new Error('Patient A failed to view their own DICOM report on patient portal!');
    }
    console.log('✅ Patient A successfully fetched their own DICOM scan via Patient Portal!');

    // Patient B attempting to fetch Patient A's DICOM report via patient portal route
    console.log(`[Patient Portal Security Test] Patient B attempting to access Patient A DICOM report (${reportId}) via GET /api/patient-portal/reports/${reportId}/view...`);
    const patientBUnauthorizedRes = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/api/patient-portal/reports/${reportId}/view`, {
        headers: { Authorization: `Bearer ${patientBToken}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });

    console.log(`Patient B View Status: ${patientBUnauthorizedRes.status}`);
    console.log(`Patient B Response Body:`, patientBUnauthorizedRes.body);

    if (patientBUnauthorizedRes.status !== 403) {
      throw new Error(`SECURITY VIOLATION: Unauthorized Patient B was not blocked on patient portal (Status ${patientBUnauthorizedRes.status})`);
    }
    console.log('✅ TEST 4 PASS: Patient portal security guard verified! Patient B blocked with 403 Forbidden ("Access denied for this report")!\n');

    // Cleanup
    await Report.destroy({ where: { id: reportId } });
    await Patient.destroy({ where: { id: [patientA.id, patientB.id] } });
    await User.destroy({ where: { id: staffUser.id } });
    await Hospital.destroy({ where: { id: [hospitalA.id, hospitalB.id] } });

    console.log('=============== ALL DICOM VERIFICATION TESTS PASSED CLEANLY! ===============');
    process.exit(0);
  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  }
}

runDicomVerification();
