const path = require('path');
const { Op } = require('sequelize');

// Ensure working dir is backend
const models = require(path.join(__dirname, '..', 'src', 'models'));

const { sequelize, Report, MedicineInvoice } = models;

async function run(apply = false) {
  console.log(`Backfill Reports -> Invoices (apply=${apply})`);
  const reports = await Report.findAll({ where: { type: 'prescription', invoiceId: null } });
  console.log(`Found ${reports.length} prescription reports without invoiceId`);
  let matched = 0;
  let updated = 0;
  let unmatched = 0;

  for (const r of reports) {
    let foundInvoice = null;
    try {
      // Try match by patientId and invoiceDate == createdAt date (best-effort)
      if (r.patientId) {
        const createdDate = new Date(r.createdAt);
        const dateStr = createdDate.toISOString().slice(0, 10);
        foundInvoice = await MedicineInvoice.findOne({
          where: { patientId: r.patientId, invoiceDate: dateStr },
          order: [['invoiceDate', 'DESC']],
        });
        if (!foundInvoice) {
          // allow +-1 day window
          const prev = new Date(createdDate);
          prev.setDate(prev.getDate() - 1);
          const next = new Date(createdDate);
          next.setDate(next.getDate() + 1);
          const prevStr = prev.toISOString().slice(0, 10);
          const nextStr = next.toISOString().slice(0, 10);
          foundInvoice = await MedicineInvoice.findOne({
            where: {
              patientId: r.patientId,
              invoiceDate: { [Op.between]: [prevStr, nextStr] },
            },
            order: [['invoiceDate', 'DESC']],
          });
        }
      }

      // Try parse invoice number from filename or originalName
      if (!foundInvoice && r.originalName) {
        const m = /MED-[0-9A-F]{4,}/i.exec(r.originalName);
        if (m) {
          const candidate = m[0];
          foundInvoice = await MedicineInvoice.findOne({ where: { invoiceNumber: { [Op.iLike]: candidate } } });
        }
      }

      if (!foundInvoice && r.description) {
        const m2 = /MED-[0-9A-F]{4,}/i.exec(r.description);
        if (m2) {
          const candidate = m2[0];
          foundInvoice = await MedicineInvoice.findOne({ where: { invoiceNumber: { [Op.iLike]: candidate } } });
        }
      }

      if (foundInvoice) {
        matched += 1;
        console.log(`Matched report ${r.id} -> invoice ${foundInvoice.id}`);
        if (apply) {
          await r.update({ invoiceId: foundInvoice.id });
          updated += 1;
        }
      } else {
        unmatched += 1;
      }
    } catch (err) {
      console.error(`Error matching report ${r.id}:`, err.message || err);
    }
  }

  console.log(`Summary: total=${reports.length} matched=${matched} updated=${updated} unmatched=${unmatched}`);
  return { total: reports.length, matched, updated, unmatched };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  run(apply).then((res) => {
    console.log('Done', res);
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = run;
