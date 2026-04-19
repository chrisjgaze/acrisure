export type ActorType =
  | "client_magic_link_user"
  | "broker_user"
  | "admin_user"
  | "system_job";

export interface Actor {
  actorId: string;
  actorType: ActorType;
  clientId?: string | null;
  teamId?: string | null;
  brokerId?: string | null;
  tenantId?: string | null;
  permissions: string[];
  authContext: {
    source: "client_proof" | "supabase_jwt" | "system";
  };
}
