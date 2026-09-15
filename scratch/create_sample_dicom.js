const fs = require('fs');
const path = require('path');

// Generates a valid minimal DICOM binary file (.dcm) with standard DICM header (128 preamble + "DICM")
function createMinimalDicomFile(outputPath) {
  const preamble = Buffer.alloc(128, 0); // 128 null preamble bytes
  const magic = Buffer.from('DICM', 'ascii'); // DICM magic header bytes

  // Basic explicit VR DICOM elements:
  // Tag (0008, 0060) Modality CS = "CT"
  const modalityTag = Buffer.from([0x08, 0x00, 0x60, 0x00, 0x43, 0x53, 0x02, 0x00, 0x43, 0x54]); 

  // Tag (0010, 0010) PatientName PN = "TEST^PATIENT"
  const patientNameTag = Buffer.from([
    0x10, 0x00, 0x10, 0x00, 0x50, 0x4e, 0x0c, 0x00, 0x54, 0x45, 0x53, 0x54, 0x5e, 0x50, 0x41, 0x54, 0x49, 0x45, 0x4e, 0x54
  ]);

  // Tag (0028, 0010) Rows US = 128
  const rowsTag = Buffer.from([0x28, 0x00, 0x10, 0x00, 0x55, 0x53, 0x02, 0x00, 0x80, 0x00]);

  // Tag (0028, 0011) Columns US = 128
  const colsTag = Buffer.from([0x28, 0x00, 0x11, 0x00, 0x55, 0x53, 0x02, 0x00, 0x80, 0x00]);

  // Tag (7FE0, 0010) PixelData OW = 128x128 16-bit pixels (32768 bytes)
  const pixelHeader = Buffer.from([0xe0, 0x7f, 0x10, 0x00, 0x4f, 0x57, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00]);
  const pixelBytes = Buffer.alloc(32768, 128); // dummy pixel array

  const dicomBuffer = Buffer.concat([
    preamble,
    magic,
    modalityTag,
    patientNameTag,
    rowsTag,
    colsTag,
    pixelHeader,
    pixelBytes
  ]);

  fs.writeFileSync(outputPath, dicomBuffer);
  console.log(`Generated sample DICOM file at ${outputPath} (Size: ${dicomBuffer.length} bytes)`);
  return dicomBuffer;
}

if (require.main === module) {
  createMinimalDicomFile(path.join(__dirname, 'test_scan.dcm'));
}

module.exports = { createMinimalDicomFile };
