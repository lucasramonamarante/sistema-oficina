# P0 — Release gate for production

**IMPORTANT:** Working systems with real customers. No merge/redeploy, migrations, database writes, service restarts, or key revocation until the preflight is complete. A GitHub branch is a source-code checkpoint, **not** a database backup.

## Required before publishing this branch
- [ ] Verify a recent successful database backup **and** test restoration to an isolated environment, without touching the production database.
- [ ] Confirm all customer/order data and attached images are covered by the recovery plan.
- [ ] Put a cryptographically random, unique 32+ byte SESSION_SECRET in the Railway application service environment (never in GitHub); e.g. generate securely on a trusted machine: `openssl rand -hex 48`.
- [ ] Rotate the externally exposed image-upload key at its provider, and configure IMGBB_API_KEY in Railway before deploying; test uploading a small real photo without publishing any customer record.
- [ ] Test the database TLS chain in a safe isolated service. Never disable TLS verification as a workaround.
- [ ] Confirm that the current admin account works with the migrated login. /setup-admin will be HTTP 410.
- [ ] Make sure the affected Railway service uses HTTPS and the new session cookie is HttpOnly, Secure, SameSite=Strict.
- [ ] Run `npm ci --ignore-scripts`, `npm test`, and a dependency advisory scan. Confirm business workflows on a test database, including login/logout, client registration, vehicle search, OS create/edit, image upload, history, PDF export and password change.
- [ ] Check HTTP 401 for business APIs without a valid session and HTTP 403 on cross-site mutation requests.
- [ ] Have tested rollback procedures ready (application rollback **does not** roll back database writes).
- [ ] Capture pre-/post-release health, error rate and response time; schedule a controlled launch window.

## Notes
- Existing users need to log in again after this release because the previous browser token is not a secure session.
- Do not run an automated schema alteration during deployment. All future changes should use reviewed migrations.
- Store backup archives encrypted, separate from source repositories and from the production database, with limited access and retention.
- These tasks are pending until an operator can verify snapshots and recovery in the database provider UI.

## Garagem 184 — external TiDB

The app has DATABASE_URL pointing to an external TiDB-compatible database, outside this Railway project. No database volume exists in Garagem_184 Railway. Back up at **TiDB Cloud**, not by creating a Railway app volume:
1. Identify the cluster and its Starter/Essential/Dedicated/Premium plan from the TiDB dashboard (secrets are not available via Railway OAuth tools).
2. Verify automatic backup policy, most recent completed backup, recovery window, and a restorable point.
3. Restore to a **new isolated TiDB instance/cluster** as allowed by the plan, validate schema and row counts, and never overwrite the live instance.
4. Export a second encrypted logical backup to a separately controlled location if supported.
5. Preserve all image provider assets separately. Database photo URLs alone are not image backups.
6. Review the existing NODE_TLS_REJECT_UNAUTHORIZED variable: remove any insecure override only after verifying the CA trust chain in the test environment.

Official vendor docs: https://docs.pingcap.com/tidbcloud/backup-and-restore-concepts/

