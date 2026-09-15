# Enterprise Disaster Recovery (DR) & Standby Failover Runbook

## Target SLAs
- **RPO (Recovery Point Objective)**: < 5 Minutes
- **RTO (Recovery Time Objective)**: < 30 Minutes

---

## 1. Hot Standby High Availability Architecture

```
                    ┌─────────────────────────┐
                    │      Client / DNS       │
                    └────────────┬────────────┘
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
            ┌─────────────────┐     ┌─────────────────┐
            │ Primary Node A  │────>│ Standby Node B  │
            │ (Read / Write)  │ WAL │  (Hot Standby)  │
            └─────────────────┘     └─────────────────┘
```

---

## 2. Emergency Standby Promotion Procedure

In the event of Primary DB hard crash or datacenter failure:

1. **Verify Outage**:
   ```bash
   pg_isready -h primary.internal.hms -p 5432
   ```

2. **Promote Standby Node**:
   On `standby.internal.hms`:
   ```bash
   pg_ctlcluster 15 main promote
   ```

3. **Update Application Connection String / DNS Switch**:
   Update NGINX or PgBouncer downstream configuration to target `standby.internal.hms`.

4. **Verify Application Readiness**:
   ```bash
   curl -i http://localhost:5000/api/health
   ```

---

## 3. Point-in-Time Recovery (PITR) Execution

For data corruption or accidental table deletion scenarios:

```bash
chmod +x ./pitr_restore.sh
./pitr_restore.sh "2026-09-14 13:45:00"
```
