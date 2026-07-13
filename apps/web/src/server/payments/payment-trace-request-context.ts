import {
  sql,
  type TenantQueryExecutor,
} from "@nurseconnect/database";
import type { PaymentTraceRequestContext } from "@nurseconnect/domain-payments";

type RequestContextRow = {
  id: string;
  organization_id: string | null;
  patient_user_id: string;
  assigned_nurse_user_id: string | null;
  status: string;
};

export async function resolvePaymentTraceRequestContext(
  executor: TenantQueryExecutor,
  requestId: string,
): Promise<PaymentTraceRequestContext | null> {
  const result = await executor.execute(sql`
    SELECT id, organization_id, patient_user_id, assigned_nurse_user_id, status
    FROM service_requests
    WHERE id = ${requestId}
    LIMIT 1
  `);
  const row = rowsFrom<RequestContextRow>(result).at(0);
  return row ? {
    id: row.id,
    organizationId: row.organization_id,
    patientUserId: row.patient_user_id,
    assignedNurseUserId: row.assigned_nurse_user_id,
    status: row.status,
  } : null;
}

function rowsFrom<Row extends Record<string, unknown>>(
  result: { rows?: Record<string, unknown>[] } | Record<string, unknown>[],
): Row[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as Row[];
}
