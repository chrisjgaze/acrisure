import { AppError } from "../errors/app-error";
import type { Actor } from "../types/actor";
import type { SubmissionWorkflowAggregate } from "../repositories/submission-repository";

export function assertActorMayAccessSubmission(
  actor: Actor,
  aggregate: SubmissionWorkflowAggregate
) {
  if (actor.actorType === "client_magic_link_user" && actor.clientId) {
    if (actor.clientId !== aggregate.submission.client_id) {
      throw new AppError(
        "SUBMISSION_FORBIDDEN",
        "This actor cannot access the submission.",
        403
      );
    }
  }
}

export function assertActorMaySubmitSubmission(
  actor: Actor,
  aggregate: SubmissionWorkflowAggregate
) {
  assertActorMayAccessSubmission(actor, aggregate);

  if (aggregate.submission.status === "submitted") {
    throw new AppError(
      "SUBMISSION_ALREADY_SUBMITTED",
      "Submission has already been submitted.",
      409
    );
  }
}
