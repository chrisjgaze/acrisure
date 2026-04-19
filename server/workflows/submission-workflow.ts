import type {
  SubmissionWorkflowViewModel,
  WorkflowStep,
} from "../types/submission";
import type { SubmissionWorkflowAggregate } from "../repositories/submission-repository";

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function isTradeCredit(productType: string) {
  return productType === "trade_credit";
}

function isCompanyStepComplete(company: Record<string, unknown> | null) {
  if (!company) return false;

  return [
    company.company_name,
    company.contact_name,
    company.contact_position,
    company.contact_telephone,
    company.contact_email,
  ].every(hasValue);
}

function isTradeCreditCompanyComplete(company: Record<string, unknown> | null) {
  if (!company) return false;

  return [
    company.company_name,
    company.contact_name,
    company.contact_position,
    company.contact_telephone,
    company.contact_email,
    company.nature_of_business,
    company.capacity,
  ].every(hasValue);
}

function buildTradeCreditSteps(
  aggregate: SubmissionWorkflowAggregate
): WorkflowStep[] {
  const companyComplete = isTradeCreditCompanyComplete(aggregate.company);
  const financialComplete = !!aggregate.financial;
  const customersComplete = aggregate.buyersCount > 0;
  const submitted = !!aggregate.submission.submitted_at;

  return [
    {
      stepId: "company",
      required: true,
      complete: companyComplete,
      editable: !submitted,
      locked: submitted,
      errors: companyComplete ? [] : ["Company details are incomplete."],
      warnings: [],
      lastUpdatedAt: aggregate.submission.updated_at ?? null,
    },
    {
      stepId: "financial",
      required: true,
      complete: financialComplete,
      editable: !submitted,
      locked: submitted,
      errors: financialComplete ? [] : ["Financial profile is incomplete."],
      warnings: [],
      lastUpdatedAt: aggregate.submission.updated_at ?? null,
    },
    {
      stepId: "customers",
      required: true,
      complete: customersComplete,
      editable: !submitted,
      locked: submitted,
      errors: customersComplete ? [] : ["At least one buyer is required."],
      warnings: [],
      lastUpdatedAt: aggregate.submission.updated_at ?? null,
    },
    {
      stepId: "declaration",
      required: true,
      complete: submitted,
      editable: !submitted,
      locked: submitted,
      errors: [],
      warnings: [],
      lastUpdatedAt: aggregate.submission.submitted_at ?? null,
    },
  ];
}

function buildSupplementarySteps(
  aggregate: SubmissionWorkflowAggregate
): WorkflowStep[] {
  const companyComplete = isCompanyStepComplete(aggregate.company);
  const detailComplete = !!aggregate.classDetail;
  const submitted = !!aggregate.submission.submitted_at;

  return [
    {
      stepId: "company",
      required: true,
      complete: companyComplete,
      editable: !submitted,
      locked: submitted,
      errors: companyComplete ? [] : ["Company details are incomplete."],
      warnings: [],
      lastUpdatedAt: aggregate.submission.updated_at ?? null,
    },
    {
      stepId: "product_details",
      required: true,
      complete: detailComplete,
      editable: !submitted,
      locked: submitted,
      errors: detailComplete ? [] : ["Product details are incomplete."],
      warnings: [],
      lastUpdatedAt: aggregate.submission.updated_at ?? null,
    },
    {
      stepId: "declaration",
      required: true,
      complete: submitted,
      editable: !submitted,
      locked: submitted,
      errors: [],
      warnings: [],
      lastUpdatedAt: aggregate.submission.submitted_at ?? null,
    },
  ];
}

export function buildSubmissionWorkflowViewModel(
  aggregate: SubmissionWorkflowAggregate
): SubmissionWorkflowViewModel {
  const productType = aggregate.submission.class_of_business;
  const steps = isTradeCredit(productType)
    ? buildTradeCreditSteps(aggregate)
    : buildSupplementarySteps(aggregate);

  const currentStep = steps.find((step) => !step.complete)?.stepId ?? "complete";
  const completedCount = steps.filter((step) => step.complete).length;
  const progressPercent =
    aggregate.submission.completion_pct ??
    Math.round((completedCount / steps.length) * 100);

  const availableActions =
    aggregate.submission.status === "submitted"
      ? ["view_submission"]
      : steps.slice(0, -1).every((step) => step.complete)
      ? ["save_draft", "submit"]
      : ["save_draft"];

  return {
    submission: {
      id: aggregate.submission.id,
      clientId: aggregate.submission.client_id,
      productType,
      status: aggregate.submission.status,
      version: 1,
    },
    workflow: {
      currentStep,
      progressPercent,
      availableActions,
      steps,
    },
  };
}
