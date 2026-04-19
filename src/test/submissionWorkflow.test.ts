import { describe, expect, it } from "vitest";
import { buildSubmissionWorkflowViewModel } from "../../server/workflows/submission-workflow";

describe("buildSubmissionWorkflowViewModel", () => {
  it("marks incomplete trade credit steps and only exposes save_draft", () => {
    const result = buildSubmissionWorkflowViewModel({
      submission: {
        id: "sub_1",
        client_id: "client_1",
        tenant_id: "tenant_1",
        class_of_business: "trade_credit",
        status: "in_progress",
        completion_pct: 25,
        submitted_at: null,
        updated_at: null,
      },
      company: {
        company_name: "Acme Ltd",
        contact_name: "Jane Doe",
        contact_position: "Director",
        contact_telephone: "01234",
        contact_email: "jane@example.com",
        nature_of_business: "Widgets",
        capacity: "Ltd",
      },
      financial: null,
      buyersCount: 0,
      classDetail: null,
    });

    expect(result.workflow.currentStep).toBe("financial");
    expect(result.workflow.availableActions).toEqual(["save_draft"]);
    expect(result.workflow.steps.map((step) => step.complete)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("allows submit once required supplementary steps are complete", () => {
    const result = buildSubmissionWorkflowViewModel({
      submission: {
        id: "sub_2",
        client_id: "client_2",
        tenant_id: "tenant_2",
        class_of_business: "cyber",
        status: "in_progress",
        completion_pct: 50,
        submitted_at: null,
        updated_at: null,
      },
      company: {
        company_name: "Acme Ltd",
        contact_name: "Jane Doe",
        contact_position: "Director",
        contact_telephone: "01234",
        contact_email: "jane@example.com",
      },
      financial: null,
      buyersCount: 0,
      classDetail: {
        annual_revenue_cyber: 1000000,
      },
    });

    expect(result.workflow.currentStep).toBe("declaration");
    expect(result.workflow.availableActions).toEqual(["save_draft", "submit"]);
  });
});
