export function tenantBackfillPlans(organizationId, branchId, batchSize) {
  return [
    {
      table: "service_requests",
      sql: `UPDATE service_requests t SET organization_id='${organizationId}', branch_id='${branchId}'
        WHERE t.ctid IN (SELECT ctid FROM service_requests WHERE organization_id IS NULL OR branch_id IS NULL LIMIT ${batchSize})`,
    },
    {
      table: "patients",
      sql: `UPDATE patients t SET organization_id='${organizationId}'
        WHERE t.ctid IN (SELECT ctid FROM patients WHERE organization_id IS NULL LIMIT ${batchSize})`,
    },
    {
      table: "assignments",
      sql: `WITH batch AS (SELECT a.ctid, sr.organization_id FROM assignments a
        JOIN service_requests sr ON sr.id=a.request_id WHERE a.organization_id IS NULL LIMIT ${batchSize})
        UPDATE assignments a SET organization_id=batch.organization_id FROM batch WHERE a.ctid=batch.ctid`,
    },
    {
      table: "visits",
      sql: `WITH batch AS (SELECT v.ctid, sr.organization_id, sr.branch_id FROM visits v
        JOIN assignments a ON a.id=v.assignment_id JOIN service_requests sr ON sr.id=a.request_id
        WHERE v.organization_id IS NULL OR v.branch_id IS NULL LIMIT ${batchSize})
        UPDATE visits v SET organization_id=batch.organization_id, branch_id=batch.branch_id FROM batch WHERE v.ctid=batch.ctid`,
    },
    ...["service_request_events", "payment_authorizations", "nurse_payouts"].map((table) => ({
      table,
      sql: `WITH batch AS (SELECT t.ctid, sr.organization_id FROM ${table} t
        JOIN service_requests sr ON sr.id=t.request_id WHERE t.organization_id IS NULL LIMIT ${batchSize})
        UPDATE ${table} t SET organization_id=batch.organization_id FROM batch WHERE t.ctid=batch.ctid`,
    })),
  ];
}

export function tenantBackfillChecks(organizationId, branchId) {
  return [
  ["pseudo_tenant_referral_or_care_provider_groups", `SELECT CASE WHEN count(DISTINCT NULLIF(lower(trim(organization_name)), '')) > 1 THEN count(DISTINCT NULLIF(lower(trim(organization_name)), '')) ELSE 0 END FROM referral_partners`],
  ["pseudo_tenant_service_area_groups", "SELECT CASE WHEN count(DISTINCT service_area_id) > 1 THEN count(DISTINCT service_area_id) ELSE 0 END FROM service_requests WHERE service_area_id IS NOT NULL"],
  ["pseudo_tenant_operator_groups", "SELECT CASE WHEN count(DISTINCT split_part(lower(email), '@', 2)) > 1 THEN count(DISTINCT split_part(lower(email), '@', 2)) ELSE 0 END FROM users WHERE role = 'admin' AND position('@' in email) > 0"],
  ["service_requests_null_org", "SELECT count(*) FROM service_requests WHERE organization_id IS NULL"],
  ["patients_null_org", "SELECT count(*) FROM patients WHERE organization_id IS NULL"],
  ["assignments_null_org", "SELECT count(*) FROM assignments WHERE organization_id IS NULL"],
  ["visits_null_org", "SELECT count(*) FROM visits WHERE organization_id IS NULL"],
  ["events_null_org", "SELECT count(*) FROM service_request_events WHERE organization_id IS NULL"],
  ["payment_authorizations_null_org", "SELECT count(*) FROM payment_authorizations WHERE organization_id IS NULL"],
  ["nurse_payouts_null_org", "SELECT count(*) FROM nurse_payouts WHERE organization_id IS NULL"],
  ["service_requests_null_branch", "SELECT count(*) FROM service_requests WHERE branch_id IS NULL"],
  ["visits_null_branch", "SELECT count(*) FROM visits WHERE branch_id IS NULL"],
  ["service_request_non_default_org", `SELECT count(*) FROM service_requests WHERE organization_id IS DISTINCT FROM '${organizationId}'`],
  ["service_request_non_default_branch", `SELECT count(*) FROM service_requests WHERE branch_id IS DISTINCT FROM '${branchId}'`],
  ["patient_non_default_org", `SELECT count(*) FROM patients WHERE organization_id IS DISTINCT FROM '${organizationId}'`],
  ["orphan_assignments", "SELECT count(*) FROM assignments a LEFT JOIN service_requests sr ON sr.id=a.request_id WHERE sr.id IS NULL"],
  ["orphan_visits", "SELECT count(*) FROM visits v LEFT JOIN assignments a ON a.id=v.assignment_id LEFT JOIN service_requests sr ON sr.id=a.request_id WHERE sr.id IS NULL"],
  ["orphan_events", "SELECT count(*) FROM service_request_events e LEFT JOIN service_requests sr ON sr.id=e.request_id WHERE sr.id IS NULL"],
  ["orphan_payment_authorizations", "SELECT count(*) FROM payment_authorizations p LEFT JOIN service_requests sr ON sr.id=p.request_id WHERE sr.id IS NULL"],
  ["orphan_nurse_payouts", "SELECT count(*) FROM nurse_payouts p LEFT JOIN service_requests sr ON sr.id=p.request_id WHERE sr.id IS NULL"],
  ["request_branch_org_mismatch", "SELECT count(*) FROM service_requests sr JOIN branches b ON b.id=sr.branch_id WHERE sr.organization_id IS DISTINCT FROM b.organization_id"],
  ["assignment_request_org_mismatch", "SELECT count(*) FROM assignments a JOIN service_requests sr ON sr.id=a.request_id WHERE a.organization_id IS DISTINCT FROM sr.organization_id"],
  ["visit_request_org_mismatch", "SELECT count(*) FROM visits v JOIN assignments a ON a.id=v.assignment_id JOIN service_requests sr ON sr.id=a.request_id WHERE v.organization_id IS DISTINCT FROM sr.organization_id"],
  ["visit_request_branch_mismatch", "SELECT count(*) FROM visits v JOIN assignments a ON a.id=v.assignment_id JOIN service_requests sr ON sr.id=a.request_id WHERE v.branch_id IS DISTINCT FROM sr.branch_id"],
  ["event_request_org_mismatch", "SELECT count(*) FROM service_request_events e JOIN service_requests sr ON sr.id=e.request_id WHERE e.organization_id IS DISTINCT FROM sr.organization_id"],
  ["payment_authorization_request_org_mismatch", "SELECT count(*) FROM payment_authorizations p JOIN service_requests sr ON sr.id=p.request_id WHERE p.organization_id IS DISTINCT FROM sr.organization_id"],
  ["payment_authorization_patient_mismatch", "SELECT count(*) FROM payment_authorizations p JOIN service_requests sr ON sr.id=p.request_id WHERE p.patient_user_id IS DISTINCT FROM sr.patient_user_id"],
  ["nurse_payout_request_org_mismatch", "SELECT count(*) FROM nurse_payouts p JOIN service_requests sr ON sr.id=p.request_id WHERE p.organization_id IS DISTINCT FROM sr.organization_id"],
  ];
}
