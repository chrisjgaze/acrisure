import type { Actor } from "../types/actor";

export function getClientProofActor(clientId?: string | null): Actor {
  return {
    actorId: clientId ?? "anonymous_client",
    actorType: "client_magic_link_user",
    clientId: clientId ?? null,
    permissions: ["submission:edit", "submission:submit"],
    authContext: { source: "client_proof" },
  };
}
