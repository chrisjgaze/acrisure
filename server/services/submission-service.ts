import { AppError } from "../errors/app-error";
import { getClientProofActor } from "../auth/actor";
import {
  getSubmissionWorkflowAggregate,
  markSubmissionSubmitted,
  saveCompanyStep,
  saveSubmissionTableStep,
  updateSubmissionForStepProgress,
} from "../repositories/submission-repository";
import {
  assertActorMayAccessSubmission,
  assertActorMaySubmitSubmission,
} from "../policies/submission-policy";
import { buildSubmissionWorkflowViewModel } from "../workflows/submission-workflow";
import { writeBusinessAuditEvent } from "../audit/audit-log";
import { sendSubmissionConfirmationEmail } from "./email-service";

const STEP_PROGRESS_BY_TABLE: Record<string, number> = {
  submission_company: 25,
  submission_financial: 50,
  submission_trading: 50,
  submission_buyers: 75,
  submission_overdue_accounts: 75,
  submission_loss_history: 50,
  submission_cyber: 50,
  submission_dno: 50,
  submission_terrorism: 50,
};

export async function getSubmissionWorkflow(input: {
  submissionId: string;
  clientId?: string | null;
}) {
  const aggregate = await getSubmissionWorkflowAggregate(input.submissionId);
  if (!aggregate) {
    throw new AppError("SUBMISSION_NOT_FOUND", "Submission not found.", 404);
  }

  const actor = getClientProofActor(input.clientId ?? aggregate.submission.client_id);
  assertActorMayAccessSubmission(actor, aggregate);

  return buildSubmissionWorkflowViewModel(aggregate);
}

export async function saveCompanySubmissionStep(input: {
  submissionId: string;
  clientId?: string | null;
  fields: Record<string, unknown>;
  request?: Request;
}) {
  const aggregate = await getSubmissionWorkflowAggregate(input.submissionId);
  if (!aggregate) {
    throw new AppError("SUBMISSION_NOT_FOUND", "Submission not found.", 404);
  }

  const actor = getClientProofActor(input.clientId ?? aggregate.submission.client_id);
  assertActorMayAccessSubmission(actor, aggregate);

  const { error } = await saveCompanyStep(input.submissionId, input.fields);
  if (error) {
    throw new AppError("STEP_SAVE_FAILED", error.message, 500);
  }

  await updateSubmissionForStepProgress(input.submissionId, STEP_PROGRESS_BY_TABLE.submission_company);

  if (aggregate.submission.tenant_id) {
    await writeBusinessAuditEvent({
      tenantId: aggregate.submission.tenant_id,
      submissionId: input.submissionId,
      eventType: "step_saved",
      eventDetail: { step: "company" },
      request: input.request,
    });
  }

  return getSubmissionWorkflow({
    submissionId: input.submissionId,
    clientId: aggregate.submission.client_id,
  });
}

export async function saveGenericSubmissionStep(input: {
  table: string;
  submissionId: string;
  clientId?: string | null;
  fields: Record<string, unknown>;
  request?: Request;
}) {
  const aggregate = await getSubmissionWorkflowAggregate(input.submissionId);
  if (!aggregate) {
    throw new AppError("SUBMISSION_NOT_FOUND", "Submission not found.", 404);
  }

  const actor = getClientProofActor(input.clientId ?? aggregate.submission.client_id);
  assertActorMayAccessSubmission(actor, aggregate);

  const { error } = await saveSubmissionTableStep(input.table, input.submissionId, input.fields);
  if (error) {
    throw new AppError("STEP_SAVE_FAILED", error.message, 500);
  }

  const progressPercent = STEP_PROGRESS_BY_TABLE[input.table];
  if (progressPercent) {
    await updateSubmissionForStepProgress(input.submissionId, progressPercent);
  }

  if (aggregate.submission.tenant_id) {
    await writeBusinessAuditEvent({
      tenantId: aggregate.submission.tenant_id,
      submissionId: input.submissionId,
      eventType: "step_saved",
      eventDetail: { step: input.table },
      request: input.request,
    });
  }

  return getSubmissionWorkflow({
    submissionId: input.submissionId,
    clientId: aggregate.submission.client_id,
  });
}

export async function submitSubmission(input: {
  submissionId: string;
  clientId?: string | null;
  signatureName: string;
  signaturePosition: string;
  request?: Request;
}) {
  const aggregate = await getSubmissionWorkflowAggregate(input.submissionId);
  if (!aggregate) {
    throw new AppError("SUBMISSION_NOT_FOUND", "Submission not found.", 404);
  }

  const actor = getClientProofActor(input.clientId ?? aggregate.submission.client_id);
  assertActorMaySubmitSubmission(actor, aggregate);

  const workflow = buildSubmissionWorkflowViewModel(aggregate);
  const missingSteps = workflow.workflow.steps
    .filter((step) => step.required && !step.complete && step.stepId !== "declaration")
    .map((step) => step.stepId);

  if (!input.signatureName.trim() || !input.signaturePosition.trim()) {
    throw new AppError(
      "SUBMISSION_SIGNATURE_REQUIRED",
      "Signatory name and position are required.",
      400
    );
  }

  if (missingSteps.length > 0) {
    throw new AppError(
      "SUBMISSION_INVALID_FOR_TRANSITION",
      "Submission cannot be moved to submitted state.",
      409,
      { missingSteps }
    );
  }

  const { submissionError, companyError } = await markSubmissionSubmitted({
    submissionId: input.submissionId,
    signatureName: input.signatureName.trim(),
    signaturePosition: input.signaturePosition.trim(),
  });

  if (submissionError || companyError) {
    throw new AppError(
      "SUBMISSION_SAVE_FAILED",
      submissionError?.message ?? companyError?.message ?? "Failed to submit submission.",
      500
    );
  }

  if (aggregate.submission.tenant_id) {
    await writeBusinessAuditEvent({
      tenantId: aggregate.submission.tenant_id,
      submissionId: input.submissionId,
      eventType: "submission.submitted",
      eventDetail: { product_type: aggregate.submission.class_of_business },
      request: input.request,
    });
  }

  await sendSubmissionConfirmationEmail({
    submissionId: input.submissionId,
    request: input.request,
  });

  return getSubmissionWorkflow({
    submissionId: input.submissionId,
    clientId: aggregate.submission.client_id,
  });
}
