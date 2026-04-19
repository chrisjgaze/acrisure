import { getServiceSupabase } from "../integrations/supabase";

export interface SubmissionWorkflowAggregate {
  submission: {
    id: string;
    client_id: string;
    tenant_id: string | null;
    class_of_business: string;
    status: string;
    completion_pct: number | null;
    submitted_at: string | null;
    updated_at?: string | null;
  };
  company: Record<string, unknown> | null;
  financial: Record<string, unknown> | null;
  buyersCount: number;
  classDetail: Record<string, unknown> | null;
}

function classTableForProduct(productType: string) {
  if (productType === "cyber") return "submission_cyber";
  if (productType === "dno") return "submission_dno";
  if (productType === "terrorism") return "submission_terrorism";
  return null;
}

export async function getSubmissionWorkflowAggregate(submissionId: string) {
  const supabase = getServiceSupabase();
  const { data: submission, error } = await supabase
    .from("submissions")
    .select("id, client_id, tenant_id, class_of_business, status, completion_pct, submitted_at, updated_at")
    .eq("id", submissionId)
    .single();

  if (error || !submission) {
    return null;
  }

  const classTable = classTableForProduct(submission.class_of_business);
  const [
    { data: company },
    { data: financial },
    { data: buyers },
    classDetailResult,
  ] = await Promise.all([
    supabase
      .from("submission_company")
      .select("*")
      .eq("submission_id", submissionId)
      .maybeSingle(),
    supabase
      .from("submission_financial")
      .select("*")
      .eq("submission_id", submissionId)
      .maybeSingle(),
    supabase
      .from("submission_buyers")
      .select("id")
      .eq("submission_id", submissionId)
      .limit(1),
    classTable
      ? supabase.from(classTable).select("*").eq("submission_id", submissionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const aggregate: SubmissionWorkflowAggregate = {
    submission,
    company: company ?? null,
    financial: financial ?? null,
    buyersCount: buyers?.length ?? 0,
    classDetail: classDetailResult?.data ?? null,
  };

  return aggregate;
}

export async function saveCompanyStep(
  submissionId: string,
  fields: Record<string, unknown>
) {
  const supabase = getServiceSupabase();
  return supabase
    .from("submission_company")
    .upsert({ ...fields, submission_id: submissionId }, { onConflict: "submission_id" });
}

export async function saveSubmissionTableStep(
  table: string,
  submissionId: string,
  fields: Record<string, unknown>
) {
  const supabase = getServiceSupabase();
  return supabase
    .from(table)
    .upsert({ ...fields, submission_id: submissionId }, { onConflict: "submission_id" });
}

export async function updateSubmissionForStepProgress(
  submissionId: string,
  progressPercent: number
) {
  const supabase = getServiceSupabase();
  return supabase
    .from("submissions")
    .update({
      completion_pct: progressPercent,
      last_activity: new Date().toISOString(),
      status: progressPercent > 0 ? "in_progress" : undefined,
    })
    .eq("id", submissionId);
}

export async function markSubmissionSubmitted(input: {
  submissionId: string;
  signatureName: string;
  signaturePosition: string;
}) {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  const [{ error: submissionError }, { error: companyError }] = await Promise.all([
    supabase
      .from("submissions")
      .update({
        status: "submitted",
        submitted_at: now,
        declaration_accepted: true,
        declaration_accepted_at: now,
        completion_pct: 100,
        last_activity: now,
      })
      .eq("id", input.submissionId),
    supabase
      .from("submission_company")
      .upsert(
        {
          submission_id: input.submissionId,
          contact_name: input.signatureName,
          contact_position: input.signaturePosition,
        },
        { onConflict: "submission_id" }
      ),
  ]);

  return { submissionError, companyError };
}
