#!/bin/bash
# ==============================================================================
# PostgreSQL WAL Continuous Archiving & Nightly Base Backup Script
# RPO Target: 5 Minutes | RTO Target: 30 Minutes
# ==============================================================================

set -eo pipefail

BACKUP_DIR="/var/backups/postgresql/base"
WAL_ARCHIVE_DIR="/var/backups/postgresql/wal_archive"
S3_BUCKET="s3://hms-disaster-recovery-backups/postgres"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BASE_BACKUP_FILE="${BACKUP_DIR}/base_backup_${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}" "${WAL_ARCHIVE_DIR}"

echo "[DR BACKUP] Starting nightly PostgreSQL base backup at $(date)..."

# Take base backup via pg_basebackup
pg_basebackup -h localhost -U postgres -D "${BACKUP_DIR}/temp_${TIMESTAMP}" -Ft -z -P

mv "${BACKUP_DIR}/temp_${TIMESTAMP}/base.tar.gz" "${BASE_BACKUP_FILE}"
rm -rf "${BACKUP_DIR}/temp_${TIMESTAMP}"

echo "[DR BACKUP] Syncing base backup and WAL archives to cloud storage..."
if command -v aws &> /dev/null; then
    aws s3 sync "${WAL_ARCHIVE_DIR}" "${S3_BUCKET}/wal_archive/"
    aws s3 cp "${BASE_BACKUP_FILE}" "${S3_BUCKET}/base/"
fi

# Cleanup local base backups older than 7 days
find "${BACKUP_DIR}" -type f -name "base_backup_*.tar.gz" -mtime +7 -delete

echo "[DR BACKUP] Base backup completed successfully: ${BASE_BACKUP_FILE}"
