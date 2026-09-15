'use strict';

const { sequelize } = require('../models');

class GlobalSearchService {
  /**
   * Universal search across Patients, Appointments, Prescriptions, Labs, Radiology, Invoices
   */
  static async search({ q, hospitalId, limit = 20 }) {
    if (!q || !q.trim()) return [];

    const queryStr = q.trim();
    const cleanHospitalId = Number(hospitalId) || 1;

    // Fast UHID exact or prefix match first
    const [exactUhidResults] = await sequelize.query(`
      SELECT entity_type, entity_id, uhid, title, subtitle, content 
      FROM global_search_index 
      WHERE hospital_id = :hospitalId AND uhid ILIKE :uhidPattern
      LIMIT :limit
    `, {
      replacements: { hospitalId: cleanHospitalId, uhidPattern: `%${queryStr}%`, limit }
    });

    if (exactUhidResults.length > 0) {
      return exactUhidResults;
    }

    // Full-Text Search with Trigram Fuzzy Fallback
    const [ftsResults] = await sequelize.query(`
      SELECT entity_type, entity_id, uhid, title, subtitle, content,
             SIMILARITY(content, :q) AS rank_score
      FROM global_search_index
      WHERE hospital_id = :hospitalId
        AND (content ILIKE :trgmPattern OR SIMILARITY(content, :q) > 0.15)
      ORDER BY rank_score DESC
      LIMIT :limit
    `, {
      replacements: { hospitalId: cleanHospitalId, q: queryStr, trgmPattern: `%${queryStr}%`, limit }
    });

    return ftsResults;
  }
}

module.exports = GlobalSearchService;
