export type SubmissionStatus =
  | "not_started"
  | "draft"
  | "in_progress"
  | "submitted"
  | "awaiting_quotes"
  | "quoted"
  | "bound"
  | "declined"
  | "referred"
  | "lapsed"
  | "archived";

export interface WorkflowStep {
  stepId: string;
  required: boolean;
  complete: boolean;
  editable: boolean;
  locked: boolean;
  errors: string[];
  warnings: string[];
  lastUpdatedAt: string | null;
}

export interface SubmissionWorkflowViewModel {
  submission: {
    id: string;
    clientId: string;
    productType: string;
    status: SubmissionStatus | string;
    version: number;
  };
  workflow: {
    currentStep: string;
    progressPercent: number;
    availableActions: string[];
    steps: WorkflowStep[];
  };
}
