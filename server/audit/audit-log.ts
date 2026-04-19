import { logAuditEvent } from "../../api/_audit";

export async function writeBusinessAuditEvent(input: {
  tenantId: string;
  userId?: string | null;
  submissionId?: string | null;
  eventType: string;
  eventDetail?: Record<string, unknown>;
  request?: Request;
}) {
  await logAuditEvent(input);
}
