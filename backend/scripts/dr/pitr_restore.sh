#!/bin/bash
# ==============================================================================
# Point-In-Time Recovery (PITR) Restore Script
# Accepts Target Restore Timestamp e.g. '2026-09-14 13:50:00'
# ==============================================================================

set -eo pipefail

RESTORE_TIMESTAMP="$1"
PG_DATA_DIR="/var/lib/postgresql/data"
WAL_ARCHIVE_DIR="/var/backups/postgresql/wal_archive"

if [ -z "${RESTORE_TIMESTAMP}" ]; then
    echo "Usage: $0 'YYYY-MM-DD HH:MM:SS'"
    exit 1
fi

echo "[DR RESTORE] Initiating Point-In-Time Recovery to timestamp: ${RESTORE_TIMESTAMP}..."

# Stop PostgreSQL service
systemctl stop postgresql

# Backup current corrupt data directory
mv "${PG_DATA_DIR}" "${PG_DATA_DIR}_corrupt_$(date +%s)"
mkdir -p "${PG_DATA_DIR}"
chmod 700 "${PG_DATA_DIR}"

# Extract latest base backup
LATEST_BASE=$(ls -t /var/backups/postgresql/base/base_backup_*.tar.gz | head -n 1)
echo "[DR RESTORE] Extracting base backup: ${LATEST_BASE}"
tar -xzf "${LATEST_BASE}" -C "${PG_DATA_DIR}"

# Write recovery target signal file
cat <<EOF > "${PG_DATA_DIR}/recovery.signal"
restore_command = 'cp ${WAL_ARCHIVE_DIR}/%f %p'
recovery_target_time = '${RESTORE_TIMESTAMP}'
recovery_target_action = 'promote'
EOF

chown -R postgres:postgres "${PG_DATA_DIR}"

# Start PostgreSQL service to trigger WAL replay up to target timestamp
systemctl start postgresql

echo "[DR RESTORE] Recovery process initiated. Monitoring PostgreSQL logs..."
tail -n 30 /var/log/postgresql/postgresql-main.log
