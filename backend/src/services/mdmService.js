'use strict';

const { MasterCatalog, CatalogVersion, CatalogSyncJob, Hospital } = require('../models');

class MDMService {
  static async publishVersion({ catalogCode, version, dataPayload, userId }) {
    const catalog = await MasterCatalog.findOne({ where: { catalogCode } });
    if (!catalog) throw new Error(`Master catalog code ${catalogCode} not found.`);

    const catalogVer = await CatalogVersion.create({
      masterCatalogId: catalog.id,
      version,
      dataPayload,
      publishedBy: userId
    });

    await catalog.update({ activeVersion: version });

    // Broadcast sync jobs to all active tenant hospitals
    const hospitals = await Hospital.findAll({ attributes: ['id'] });
    const syncJobs = hospitals.map(h => ({
      catalogVersionId: catalogVer.id,
      targetHospitalId: h.id,
      status: 'PENDING'
    }));

    await CatalogSyncJob.bulkCreate(syncJobs);

    return {
      message: `Master catalog ${catalogCode} ${version} published and sync scheduled across ${hospitals.length} hospitals.`,
      catalogVersionId: catalogVer.id
    };
  }

  static async getCatalogs() {
    return await MasterCatalog.findAll({
      include: [{ model: CatalogVersion, limit: 5, order: [['createdAt', 'DESC']] }]
    });
  }
}

module.exports = MDMService;
