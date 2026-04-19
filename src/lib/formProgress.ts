import { useState, useEffect, useCallback } from "react";

export function useStepCompletion(submissionId: string | null, isRenewal = false) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const refresh = useCallback(async () => {
    if (!submissionId) return;

    const clientId = sessionStorage.getItem("ff_client_id");
    const params = new URLSearchParams({ submissionId });
    if (clientId) params.set("clientId", clientId);

    try {
      const res = await fetch(`/api/submissions/workflow?${params.toString()}`);
      if (!res.ok) return;

      const data = await res.json() as {
        workflow?: { steps?: { complete: boolean }[] };
      };

      const steps = (data.workflow?.steps ?? [])
        .map((step, index) => (step.complete ? index : -1))
        .filter((index) => index >= 0);

      setCompletedSteps(steps);
    } catch {
      // Keep the last-known state if the workflow query fails.
    }
  }, [submissionId]);

  useEffect(() => {
    if (!isRenewal) refresh();
  }, [refresh, isRenewal]);

  return { completedSteps, refresh };
}
