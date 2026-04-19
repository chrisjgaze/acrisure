# Backend Refactor Specification

## Title
Move Workflow Logic Out of React and Into a Structured Backend Application Layer

## Version
1.0

## Date
2026-04-17

## Owner
Engineering

---

## 1. Purpose

This specification defines how to refactor the current platform so that workflow, permissions, state transitions, business rules, and side effects are executed by the backend rather than by the React frontend.

The goal is to make the frontend a presentation and input layer, while the backend becomes the source of truth for:

- workflow progression
- permissions and role checks
- validation beyond field-level form validation
- submission state transitions
- quote-comparison orchestration
- PDF generation initiation
- email sending initiation
- audit logging
- background-job triggering

This change is required to improve:

- security
- maintainability
- testability
- data integrity
- auditability
- portability away from Vercel-specific backend assumptions

---

## 2. Current State

Based on the current project brief, the application consists of:

- React 18 + TypeScript + Vite frontend
- TanStack React Query, React Hook Form, Zod
- Supabase for database, auth, and RLS
- Vercel functions in `api/`
- broker dashboard and client submission workflow
- magic-link client intake
- quote comparison using AI
- PDF generation and confirmation emails
- admin user/product management
- audit-related features and lapse processing

Current risk areas:

1. React likely contains workflow logic such as:
   - whether a step is editable
   - whether a submission may be submitted
   - whether a broker may trigger quote comparison
   - whether a PDF may be generated
   - whether an action should send email

2. Backend endpoints are likely too thin or too endpoint-specific without a shared service layer.

3. Business rules may be duplicated across:
   - page components
   - form components
   - route guards
   - API handlers

4. Heavy or privileged operations may be too closely coupled to request/response flow.

---

## 3. Target State

The target architecture shall follow this separation:

### 3.1 Frontend responsibilities

The frontend shall only be responsible for:

- rendering pages and components
- collecting user input
- local field validation and UX validation
- calling backend commands/queries
- displaying workflow state returned by the backend
- displaying available actions returned by the backend
- displaying server-side validation errors

The frontend shall not be responsible for:

- deciding whether an action is allowed
- deciding which workflow transitions are valid
- deciding whether a step is complete in a business sense
- deciding whether a PDF should be generated
- deciding whether an email should be sent
- deciding whether a quote comparison may run
- deciding whether a user has permission beyond basic session presence

### 3.2 Backend responsibilities

The backend shall be responsible for:

- role and permission enforcement
- workflow state transitions
- business-rule validation
- submission progress calculation
- step availability and lock state
- generation of workflow view models for the frontend
- orchestration of document, email, and AI actions
- audit-event creation
- durable update of state in Postgres
- initiating asynchronous work where required

### 3.3 Data and infrastructure responsibilities

The data and infrastructure layer shall provide:

- Postgres persistence via Supabase
- RLS as defense in depth, not as the only business enforcement layer
- object/file storage
- auth/session lookup
- queues or background mechanisms for async jobs
- observability and structured logs

---

## 4. Design Principles

The refactor shall follow these principles:

1. **Backend as source of truth**  
   Any business action must be accepted or rejected by backend rules.

2. **Thin route handlers**  
   API handlers shall parse requests, authenticate users, call services, and return responses only.

3. **Command-oriented backend**  
   Business actions shall use explicit commands instead of generic CRUD where practical.

4. **Deterministic workflow state**  
   Workflow transitions must be explicit, validated, and auditable.

5. **Frontend consumes view model**  
   The frontend should render from server-calculated state, not infer it independently.

6. **Framework portability**  
   Business logic must not depend on Vercel-specific runtime assumptions.

7. **Async separation**  
   Long-running or failure-prone side effects must not block user-facing request flow if they do not need to.

8. **Idempotent commands where possible**  
   Retry-safe behavior shall be supported for critical actions.

---

## 5. Scope

### In scope

- extraction of workflow logic from React
- creation of backend application/service layer
- creation of policy, workflow, validator, and repository modules
- redesign of API endpoints into explicit commands/queries
- standard response shapes for frontend workflow rendering
- audit logging for business actions
- async job boundaries for heavy tasks
- test strategy for backend workflow and policy logic
- migration path away from Vercel-coupled backend design

### Out of scope for this phase

- full re-platforming of frontend
- replacement of Supabase
- redesign of the product UI
- replacement of Anthropic or Resend
- redesign of quote-comparison prompts/models
- complete event-driven architecture
- full workflow engine adoption

---

## 6. Backend Technology Direction

The backend application layer shall be written in TypeScript and Node-compatible modules.

### Phase 1 runtime

- existing API entrypoints may continue to run in the current `api/` runtime
- route handlers shall be refactored to thin wrappers
- all business logic shall be moved into shared server modules

### Phase 2 runtime options

The backend logic shall be portable to one of the following without major business-logic rewrites:

- Fastify service
- NestJS service
- Express service
- other Node-compatible HTTP runtime

### Non-goal

The business logic shall not remain embedded inside Vercel-specific function files.

---

## 7. Proposed Backend Structure

```txt
api/
  submissions/
    create.ts
    get.ts
    save-step.ts
    submit.ts
    reopen.ts
    request-quotes.ts
    compare-quotes.ts
    select-quote.ts
    generate-pdf.ts
    send-confirmation.ts
  clients/
    create.ts
    invite.ts
  admin/
    assign-products.ts
    manage-user.ts
  documents/
    upload-metadata.ts
    reprocess.ts

server/
  auth/
    actor.ts
  services/
    submission-service.ts
    client-service.ts
    invitation-service.ts
    quote-service.ts
    document-service.ts
    pdf-service.ts
    email-service.ts
    admin-service.ts
  workflows/
    submission-workflow.ts
    quote-workflow.ts
  policies/
    submission-policy.ts
    quote-policy.ts
    admin-policy.ts
  validators/
    submission-validator.ts
    quote-validator.ts
    invitation-validator.ts
  repositories/
    submission-repository.ts
    client-repository.ts
    quote-repository.ts
    document-repository.ts
    audit-repository.ts
  integrations/
    supabase.ts
    resend.ts
    anthropic.ts
    companies-house.ts
    storage.ts
  jobs/
    enqueue-job.ts
    job-types.ts
  audit/
    audit-log.ts
  types/
    actor.ts
    submission.ts
    quote.ts
    api.ts
```

### Rules

- `api/` files may not contain business logic beyond request parsing and response formatting.
- `services/` orchestrate use cases.
- `policies/` decide permissions.
- `workflows/` decide state transitions and progress rules.
- `validators/` validate payloads and invariants.
- `repositories/` own DB access.
- `integrations/` wrap third-party APIs/SDKs.
- `jobs/` define asynchronous work initiation.

---

## 8. Core Domain Concepts

### 8.1 Actor

An actor is the authenticated or token-authorised user performing an action.

Actor types:

- client_magic_link_user
- broker_user
- admin_user
- system_job

Required actor fields:

- `actorId`
- `actorType`
- `teamId` if applicable
- `brokerId` if applicable
- `permissions[]`
- `authContext` including auth source and token claims

### 8.2 Submission

A submission is the main workflow aggregate.

Minimum required backend fields:

- `submissionId`
- `clientId`
- `productType`
- `status`
- `currentStep`
- `createdBy`
- `submittedAt`
- `lockedAt`
- `reopenedAt`
- `selectedQuoteId`
- `progressSnapshot`
- `version`

### 8.3 Quote

A quote is an insurer quote candidate associated with a submission.

Minimum required backend fields:

- `quoteId`
- `submissionId`
- `sourceDocumentId`
- `insurerName`
- `comparisonStatus`
- `comparisonVersion`
- `selected`
- `brokerDecision`

### 8.4 Document

A document is a stored uploaded file or generated output.

Minimum required fields:

- `documentId`
- `submissionId`
- `documentType`
- `storagePath`
- `mimeType`
- `uploadedBy`
- `processingStatus`
- `hash`
- `metadata`

---

## 9. Workflow Model

## 9.1 Submission statuses

Initial controlled statuses:

- `draft`
- `in_progress`
- `submitted`
- `awaiting_quotes`
- `quoted`
- `bound`
- `declined`
- `lapsed`
- `archived`

### Notes

- If existing statuses differ, map current values to this controlled set or define an approved replacement set before implementation.
- Status values shall be owned by backend constants/shared types, not string literals spread through frontend files.

## 9.2 Allowed transitions

Minimum transition rules:

- `draft -> in_progress`
- `in_progress -> submitted`
- `submitted -> awaiting_quotes`
- `awaiting_quotes -> quoted`
- `quoted -> bound`
- `quoted -> declined`
- `submitted -> declined`
- `submitted -> reopened` is not a status; it is an action resulting in `in_progress`
- `bound -> archived`
- `declined -> archived`
- `in_progress -> lapsed` only by system rule if explicitly defined

Transitions must be enforced by backend workflow code.

## 9.3 Workflow guards

A transition may only occur if guards pass.

Examples:

- `in_progress -> submitted`
  - all required sections complete
  - no blocking validation errors
  - magic link valid if client-triggered
  - actor has permission to submit

- `submitted -> awaiting_quotes`
  - actor is broker_user
  - submission is complete and locked
  - required quote-request prerequisites met

- `awaiting_quotes -> quoted`
  - at least one quote document processed successfully
  - comparison result or broker-reviewed quote data available

- `quoted -> bound`
  - selected quote exists
  - actor is broker_user or authorised admin

## 9.4 Step state

Step state shall not be inferred solely by frontend routing.

Each step shall have backend-derived fields:

- `stepId`
- `required`
- `complete`
- `editable`
- `locked`
- `errors[]`
- `warnings[]`
- `lastUpdatedAt`

---

## 10. API Design

## 10.1 Principles

- Prefer command endpoints for business actions.
- Avoid generic `PATCH submission` endpoints for state changes.
- Separate read models from mutating commands.
- Return workflow-aware response payloads.

## 10.2 Required command endpoints

Minimum required command endpoints:

- `POST /api/clients/:clientId/submissions`
- `POST /api/submissions/:submissionId/save-step`
- `POST /api/submissions/:submissionId/submit`
- `POST /api/submissions/:submissionId/reopen`
- `POST /api/submissions/:submissionId/request-quotes`
- `POST /api/submissions/:submissionId/compare-quotes`
- `POST /api/submissions/:submissionId/select-quote`
- `POST /api/submissions/:submissionId/generate-pdf`
- `POST /api/submissions/:submissionId/send-confirmation`
- `POST /api/submissions/:submissionId/upload-document-metadata`

## 10.3 Required query endpoints

Minimum required query endpoints:

- `GET /api/submissions/:submissionId`
- `GET /api/submissions/:submissionId/workflow`
- `GET /api/clients/:clientId/submissions`
- `GET /api/submissions/:submissionId/documents`
- `GET /api/submissions/:submissionId/quotes`

## 10.4 Response shape

All workflow-facing responses should include a normalised server view model.

Example:

```json
{
  "submission": {
    "id": "sub_123",
    "status": "in_progress",
    "productType": "cyber",
    "version": 8
  },
  "workflow": {
    "currentStep": "financial_details",
    "progressPercent": 57,
    "availableActions": ["save_draft", "submit"],
    "steps": [
      {
        "stepId": "company_details",
        "required": true,
        "complete": true,
        "editable": true,
        "locked": false,
        "errors": [],
        "warnings": []
      }
    ]
  },
  "audit": {
    "lastAction": "step_saved",
    "lastActionAt": "2026-04-17T10:00:00Z"
  }
}
```

## 10.5 Error format

Standard error structure:

```json
{
  "error": {
    "code": "SUBMISSION_INVALID_FOR_TRANSITION",
    "message": "Submission cannot be moved to submitted state.",
    "details": {
      "missingSteps": ["buyers", "review"]
    }
  }
}
```

Required classes of error codes:

- auth errors
- permission errors
- validation errors
- workflow transition errors
- integration errors
- concurrency errors
- idempotency/retry errors

---

## 11. Service Responsibilities

## 11.1 Submission service

Responsibilities:

- create submissions
- save step payloads
- validate completion
- calculate progress
- return workflow view model
- submit submission
- reopen submission
- enforce optimistic concurrency

Must not directly know UI routing details.

## 11.2 Quote service

Responsibilities:

- register quote documents
- request quote processing
- trigger comparison jobs
- store comparison results
- support broker quote selection
- enforce quote-related workflow rules

## 11.3 Document service

Responsibilities:

- register uploaded documents
- validate document type and linkage
- manage processing status
- trigger extraction/comparison work
- manage generated document metadata

## 11.4 Invitation service

Responsibilities:

- create secure magic-link invitation records
- enforce expiry and reuse rules
- revoke and reissue links
- record acceptance/access events

## 11.5 PDF service

Responsibilities:

- validate that generation is allowed
- create generation job or request
- store resulting output metadata
- return job/result reference

## 11.6 Email service

Responsibilities:

- validate email trigger rules
- render and send allowed email types
- persist delivery attempt metadata
- support retry state if async

## 11.7 Admin service

Responsibilities:

- manage team member permissions
- manage product assignments
- enforce admin-only rules
- write audit events for admin actions

---

## 12. Policy Layer

Policy modules shall be responsible for permission decisions.

They must answer questions such as:

- may this actor edit this submission?
- may this actor submit this submission?
- may this actor reopen this submission?
- may this actor view these quotes?
- may this actor compare quotes?
- may this actor manage this team member?

Policies must use:

- actor role
- team relationship
- client/submission ownership
- auth context
- invitation/token validity
- product entitlement

Policies shall not perform persistence themselves; they may depend on already-loaded domain objects or dedicated policy queries.

---

## 13. Validation Layer

Validation shall be split into two levels.

### 13.1 UI/form validation

Retained in frontend for usability only:

- required field prompts
- immediate input feedback
- type/format checks

### 13.2 Backend business validation

Mandatory on server:

- step payload validity
- cross-field rules
- cross-step rules
- product-type-specific requirements
- eligibility/invariant rules
- transition readiness
- document-to-submission consistency

Rule: no business action may rely solely on frontend Zod schemas.

---

## 14. Repository Layer

Repositories shall encapsulate all data access.

Required repository behaviors:

- fetch by primary key with tenant/team scoping
- save step payloads
- load workflow-relevant aggregates
- update submission status atomically
- write audit events
- read/write quote comparison state
- read/write document metadata

### Repository rules

- no business decisions in repositories
- transactions must be supported where actions span multiple writes
- repositories must support optimistic concurrency using a `version` or equivalent mechanism

---

## 15. Audit Logging

Audit logging is mandatory for all business-significant actions.

### Required audit fields

- `auditId`
- `entityType`
- `entityId`
- `action`
- `actorId`
- `actorType`
- `timestamp`
- `beforeState` where appropriate
- `afterState` where appropriate
- `metadata`
- `correlationId`

### Actions that must be audited

- client created
- invitation issued/revoked/reissued
- step saved
- submission submitted
- submission reopened
- quote document uploaded
- quote comparison started/completed/failed
- quote selected
- PDF generated/requested
- confirmation email sent/requested/failed
- admin permission change
- product assignment change
- lapse action executed

---

## 16. Asynchronous Work

The following operations should be asynchronous unless trivial and guaranteed fast:

- quote document parsing
- AI quote comparison
- PDF generation
- email retries
- lapse processing
- bulk document reprocessing

## 16.1 Job model

Each async action shall create a durable job record or equivalent durable execution state.

Required job fields:

- `jobId`
- `jobType`
- `entityType`
- `entityId`
- `status`
- `attemptCount`
- `payload`
- `result`
- `lastError`
- `createdAt`
- `updatedAt`

## 16.2 Job states

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

## 16.3 Requirement

User-facing endpoints must return accepted status and job references where full completion is asynchronous.

---

## 17. Concurrency and Idempotency

The backend must support safe handling of repeated requests and competing updates.

### 17.1 Optimistic concurrency

Submission mutations shall require a current `version` or server-side equivalent check.

If version conflict occurs, return a concurrency error and latest state snapshot.

### 17.2 Idempotency

At minimum, the following commands should be idempotent or deduplicated:

- send invitation
- submit submission
- generate PDF
- send confirmation email
- compare quotes

### 17.3 Duplicate side-effect prevention

The system must prevent duplicate sending or duplicate generation due to retries, refreshes, or multiple button presses.

---

## 18. Security Requirements

1. Frontend checks are advisory only. Backend enforcement is mandatory.
2. RLS shall remain enabled as defense in depth.
3. Magic links must have:
   - expiry
   - revocation support
   - optional single-use behavior if required by policy
   - secure token hashing/storage if applicable
4. Privileged integration keys must only be used server-side.
5. Document access must be scoped to authorised actors only.
6. Audit records must be immutable or append-only by policy.
7. Admin actions must have explicit policy checks.

---

## 19. Migration Plan

## Phase 0: Discovery

Tasks:

- inventory all current React workflow logic
- inventory all existing API handlers
- document all current statuses, actions, and permissions
- document all product-type-specific form rules
- document all side effects currently initiated from React
- document all areas where UI and backend logic diverge

Deliverables:

- frontend logic extraction inventory
- endpoint inventory
- state transition inventory
- permission matrix

## Phase 1: Backend domain foundation

Tasks:

- create `server/` module structure
- add shared types for actor, submission, quote, document
- create repository interfaces and first implementations
- create audit logging utilities
- create policy and workflow scaffolding
- centralise status constants and error codes

Deliverables:

- compilable server module foundation
- common types and enums
- common error model

## Phase 2: Submission workflow migration

Tasks:

- implement `submission-service`
- implement `submission-policy`
- implement `submission-workflow`
- implement `save-step`, `submit`, `reopen`, `get-workflow`
- move progress calculation to backend
- move step lock/editability rules to backend
- return workflow view model to frontend

Deliverables:

- frontend no longer determines submission action availability
- frontend consumes backend workflow model

## Phase 3: Quote/document workflow migration

Tasks:

- implement `document-service` and `quote-service`
- move quote-upload registration logic to backend
- move quote-comparison eligibility checks to backend
- add async job initiation for comparison
- add quote selection command

Deliverables:

- React no longer decides when comparison is allowed
- quote operations controlled by backend commands

## Phase 4: PDF/email/invitation migration

Tasks:

- implement invitation service rules
- implement PDF service boundary
- implement email service boundary
- add idempotency protection
- add async handling where appropriate

Deliverables:

- side effects triggered from backend only
- duplicate send/generate prevention in place

## Phase 5: Frontend simplification

Tasks:

- remove remaining workflow logic from React components
- replace UI conditional logic with server-returned `availableActions`
- replace UI completion inference with server workflow state
- standardise API client usage

Deliverables:

- React reduced to presentation and request layer

## Phase 6: Runtime portability

Tasks:

- ensure all service modules are runtime-agnostic
- isolate HTTP transport code
- validate that handlers can be ported to Fastify/NestJS without service rewrites

Deliverables:

- backend logic portable beyond Vercel runtime

---

## 20. Frontend Refactor Requirements

The frontend must be changed as follows.

### Remove from React

- status transition decisions
- available action logic
- submit eligibility decisions
- quote-comparison eligibility decisions
- product-level business rules that affect backend correctness
- side-effect trigger sequencing decisions

### Retain in React

- field-level UX validation
- component state
- optimistic UI only where safe
- route navigation based on backend workflow state

### Required frontend consumption changes

Frontend pages must consume:

- `workflow.availableActions`
- `workflow.steps[]`
- backend error codes/messages
- backend-derived current step and status
- async job status where needed

---

## 21. Testing Requirements

## 21.1 Unit tests

Mandatory unit tests for:

- workflow transition rules
- policy decisions
- validation rules
- progress calculation
- idempotency behavior
- concurrency conflict handling

## 21.2 Integration tests

Mandatory integration tests for:

- save step end-to-end
- submit submission end-to-end
- quote comparison initiation
- PDF generation initiation
- email trigger initiation
- magic-link expiry/revocation
- admin permission enforcement

## 21.3 Regression tests

Must verify that:

- frontend cannot bypass forbidden actions
- direct API calls without permission are rejected
- duplicate operations do not create duplicate side effects
- invalid state transitions are rejected consistently

---

## 22. Observability Requirements

The backend shall emit:

- structured logs with correlation IDs
- audit events for business actions
- Sentry errors for failed commands/integrations
- metrics or counters for critical workflows where available

Minimum monitored flows:

- invitation issuance/failure
- submission submit attempts/failure
- quote comparison queueing/failure
- PDF generation queueing/failure
- email send queueing/failure

---

## 23. Acceptance Criteria

This refactor is complete when all of the following are true:

1. React no longer contains authoritative workflow transition logic.
2. Backend returns a workflow view model for submission pages.
3. All state transitions are enforced server-side.
4. Permission checks are centralised in policy modules.
5. Significant side effects originate from backend services, not React.
6. Audit records exist for all key business actions.
7. Concurrency and duplicate side-effect protections are implemented for critical commands.
8. Core business logic is portable outside Vercel function files.
9. Existing user journeys still function end to end.
10. Tests exist for workflow, policy, and command execution.

---

## 24. Risks and Mitigations

### Risk: hidden workflow logic remains in React

Mitigation:
- perform explicit extraction inventory
- fail PR review if new workflow logic is added to frontend

### Risk: duplicated rules during transition

Mitigation:
- define backend as source of truth early
- frontend reads server state even before all legacy code is removed

### Risk: breaking current flows during migration

Mitigation:
- migrate feature by feature
- keep endpoint contracts stable where possible
- use integration tests around current journeys

### Risk: async job complexity increases operational overhead

Mitigation:
- isolate only genuinely heavy work first
- define minimal durable job model before expanding

### Risk: portability goal fails because service code depends on runtime-specific objects

Mitigation:
- keep `Request/Response` and framework objects only in API entrypoints
- keep service layer pure TypeScript where possible

---

## 25. Open Decisions Requiring Confirmation

The following must be confirmed before implementation finalisation:

1. Final controlled submission status list.
2. Whether `reopened` is an audit action only or needs explicit timeline state tracking in DB.
3. Whether magic links must be single-use or multi-use within expiry.
4. Exact async mechanism to be used for jobs.
5. Exact idempotency-key strategy for retry-safe commands.
6. Whether PDF generation is synchronous for small documents or always async.
7. Whether quote comparison must block on AI result or support partial/manual mode.
8. Whether admin users may perform all broker actions or only selected ones.
9. Whether client submission edits after broker review are permitted.
10. Whether a dedicated backend runtime will be introduced now or later.

---

## 26. Recommended Immediate Next Actions

1. Approve this target architecture.
2. Run discovery on current React workflow logic.
3. Freeze new workflow logic additions to frontend.
4. Implement the `server/` module skeleton.
5. Migrate submission workflow first.
6. Migrate quote/document logic second.
7. Migrate PDF/email/invitation side effects third.
8. Add portability review before any new backend code is merged.

---

## 27. Document Review

This specification has been reviewed for implementation gaps and structural issues.

### Confirmed strengths

- defines clear separation of frontend/backend responsibilities
- specifies a target folder structure
- defines command/query API direction
- includes policies, workflows, validators, repositories, jobs, and audit layers
- includes migration sequencing
- includes testing, observability, security, concurrency, and acceptance criteria
- includes explicit open decisions rather than leaving them implicit

### Known gaps that are still open by design

These are not mistakes in the spec, but decisions still needed by the implementation team:

- final submission status vocabulary
- exact background job technology
- exact magic-link reuse model
- exact admin override model
- exact idempotency-key scheme

### Potential issue to watch

If implementation starts before the discovery phase inventories are completed, there is a high risk that hidden frontend rules will survive the refactor. Discovery should not be skipped.

### Potential issue to watch

If repositories are implemented directly against Supabase in a way that leaks Supabase response objects upward, portability will weaken. Repository return types should be domain-shaped, not SDK-shaped.

### Potential issue to watch

If the frontend continues to “helpfully” infer action availability when backend data is missing, the old anti-pattern will reappear. The frontend should fail closed and rely on backend-provided action state.

### Review conclusion

The specification is sufficiently complete to begin implementation planning, provided the open decisions in Section 25 are resolved before the relevant workstreams start.
