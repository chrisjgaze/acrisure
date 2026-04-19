import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import TenantLogo from "@/components/TenantLogo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Loader2, MoreHorizontal, Users, Shield, UserX } from "lucide-react";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────────────────

const CLASS_OPTIONS: { key: string; label: string }[] = [
  { key: "trade_credit", label: "Trade Credit" },
  { key: "cyber",        label: "Cyber" },
  { key: "dno",          label: "D&O" },
  { key: "terrorism",    label: "Terrorism" },
];

const CLASS_COLOURS: Record<string, string> = {
  trade_credit: "bg-navy text-white",
  cyber:        "bg-accent-blue text-white",
  dno:          "bg-purple-500 text-white",
  terrorism:    "bg-amber-500 text-white",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  is_admin: boolean;
  is_active: boolean;
  licensed_classes: string[];
  last_login: string | null;
  created_at: string;
}

interface MemberForm {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_admin: boolean;
  licensed_classes: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(m: TeamMember): string {
  if (m.first_name && m.last_name) return `${m.first_name[0]}${m.last_name[0]}`.toUpperCase();
  if (m.first_name) return m.first_name[0].toUpperCase();
  return m.email[0].toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function defaultForm(): MemberForm {
  return {
    email: "",
    first_name: "",
    last_name: "",
    role: "broker",
    is_admin: false,
    licensed_classes: ["trade_credit"],
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ClassToggle({
  classes,
  onChange,
}: {
  classes: string[];
  onChange: (classes: string[]) => void;
}) {
  const toggle = (key: string) =>
    onChange(
      classes.includes(key)
        ? classes.filter((c) => c !== key)
        : [...classes, key],
    );

  return (
    <div className="flex flex-wrap gap-2">
      {CLASS_OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          className={`px-3 py-1.5 rounded-full text-helper font-medium border transition-colors ${
            classes.includes(key)
              ? "bg-navy text-white border-navy"
              : "bg-card text-helper border-silver hover:border-navy"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

interface FormFieldsProps {
  form: MemberForm;
  onChange: (updates: Partial<MemberForm>) => void;
  isEdit: boolean;
  isSelf: boolean;
}

function MemberFormFields({ form, onChange, isEdit, isSelf }: FormFieldsProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-helper font-medium text-text-primary mb-1 block">First name</label>
          <input
            value={form.first_name}
            onChange={(e) => onChange({ first_name: e.target.value })}
            placeholder="Jane"
            className="w-full h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </div>
        <div>
          <label className="text-helper font-medium text-text-primary mb-1 block">Last name</label>
          <input
            value={form.last_name}
            onChange={(e) => onChange({ last_name: e.target.value })}
            placeholder="Smith"
            className="w-full h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </div>
      </div>

      {!isEdit && (
        <div>
          <label className="text-helper font-medium text-text-primary mb-1 block">
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="jane.smith@example.com"
            className="w-full h-10 px-3 text-body border border-silver rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </div>
      )}

      <div>
        <label className="text-helper font-medium text-text-primary mb-2 block">Licensed products</label>
        <ClassToggle
          classes={form.licensed_classes}
          onChange={(classes) => onChange({ licensed_classes: classes })}
        />
      </div>

      <div className="flex items-center justify-between py-1 border-t border-silver pt-4">
        <div>
          <p className="text-body font-medium text-text-primary">Admin privileges</p>
          <p className="text-helper text-helper mt-0.5">
            Can manage team members, access all clients, and anonymise client data
          </p>
        </div>
        <Switch
          checked={form.is_admin}
          onCheckedChange={(v) => onChange({ is_admin: v })}
          disabled={isSelf}
        />
      </div>

      {isSelf && (
        <p className="text-helper text-amber-600 -mt-2">
          You cannot remove your own admin privileges.
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, session, signOut, isAdmin, displayName, logoUrl } = useAuth();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<MemberForm>(defaultForm);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Edit dialog
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState<MemberForm>(defaultForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadTeam = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/list-team", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load team");
      setTeam(await res.json() as TeamMember[]);
    } catch {
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  // ── Invite ────────────────────────────────────────────────────────────────

  const openInvite = () => {
    setInviteForm(defaultForm());
    setInviteOpen(true);
  };

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) { toast.error("Email is required"); return; }
    setInviteSubmitting(true);
    try {
      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to invite user"); return; }
      toast.success(`Invite sent to ${inviteForm.email}`);
      setInviteOpen(false);
      await loadTeam();
    } catch {
      toast.error("Failed to invite user");
    } finally {
      setInviteSubmitting(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setEditForm({
      email:            m.email,
      first_name:       m.first_name ?? "",
      last_name:        m.last_name ?? "",
      role:             m.role ?? "broker",
      is_admin:         m.is_admin,
      licensed_classes: m.licensed_classes ?? ["trade_credit"],
    });
  };

  const handleEdit = async () => {
    if (!editMember) return;
    setEditSubmitting(true);
    try {
      const res = await fetch("/api/update-team-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          target_user_id:   editMember.id,
          first_name:       editForm.first_name || null,
          last_name:        editForm.last_name || null,
          role:             editForm.role,
          is_admin:         editForm.is_admin,
          licensed_classes: editForm.licensed_classes,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to update user"); return; }
      toast.success("Permissions updated");
      setEditMember(null);
      await loadTeam();
    } catch {
      toast.error("Failed to update user");
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Deactivate / Reactivate ───────────────────────────────────────────────

  const handleToggleActive = async (m: TeamMember) => {
    const newStatus = !m.is_active;
    try {
      const res = await fetch("/api/update-team-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ target_user_id: m.id, is_active: newStatus }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to update user"); return; }
      toast.success(newStatus ? "Team member reactivated" : "Team member deactivated");
      await loadTeam();
    } catch {
      toast.error("Failed to update user");
    }
  };

  // ── Derived stats ─────────────────────────────────────────────────────────

  const adminCount    = team.filter((m) => m.is_admin).length;
  const inactiveCount = team.filter((m) => !m.is_active).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-silver/30">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-16 bg-card border-b border-silver flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <TenantLogo src={logoUrl} className="h-8 w-auto" />
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-body text-helper hover:text-navy transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate("/analytics")}
              className="text-body text-helper hover:text-navy transition-colors"
            >
              Analytics
            </button>
            <span className="text-body font-medium text-navy border-b-2 border-navy pb-1">
              Admin
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-body text-text-primary hidden md:block">{displayName ?? user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Log out</Button>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="mb-1">Team</h1>
        <p className="text-helper text-helper mb-8">
          Manage your team's access, roles, and licensed products
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-lg border border-silver p-5 flex items-start gap-4">
            <div className="p-2 bg-silver/30 rounded-md shrink-0">
              <Users className="h-4 w-4 text-navy" />
            </div>
            <div>
              <p className="text-helper text-helper">Total members</p>
              <p className="text-2xl font-bold text-navy">{team.length}</p>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-silver p-5 flex items-start gap-4">
            <div className="p-2 bg-silver/30 rounded-md shrink-0">
              <Shield className="h-4 w-4 text-navy" />
            </div>
            <div>
              <p className="text-helper text-helper">Admins</p>
              <p className="text-2xl font-bold text-navy">{adminCount}</p>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-silver p-5 flex items-start gap-4">
            <div className="p-2 bg-silver/30 rounded-md shrink-0">
              <UserX className="h-4 w-4 text-navy" />
            </div>
            <div>
              <p className="text-helper text-helper">Inactive</p>
              <p className="text-2xl font-bold text-navy">{inactiveCount}</p>
            </div>
          </div>
        </div>

        {/* Team table */}
        <div className="bg-card rounded-lg shadow-card">
          <div className="flex items-center justify-between p-6 pb-4">
            <h2>Team members</h2>
            {isAdmin && (
              <Button onClick={openInvite}>+ Invite member</Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-accent-blue animate-spin" />
            </div>
          ) : team.length === 0 ? (
            <p className="text-body text-helper px-6 pb-8">No team members found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-t border-silver">
                    <th className="text-left px-6 py-3 text-helper font-medium text-helper">Name</th>
                    <th className="text-left px-6 py-3 text-helper font-medium text-helper hidden md:table-cell">
                      Products
                    </th>
                    <th className="text-left px-6 py-3 text-helper font-medium text-helper hidden lg:table-cell">
                      Role
                    </th>
                    <th className="text-left px-6 py-3 text-helper font-medium text-helper hidden lg:table-cell">
                      Last login
                    </th>
                    <th className="text-left px-6 py-3 text-helper font-medium text-helper">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-silver">
                  {team.map((m) => (
                    <tr key={m.id} className="hover:bg-silver/20 transition-colors">

                      {/* Name + email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-navy/10 text-navy flex items-center justify-center text-helper font-semibold shrink-0">
                            {getInitials(m)}
                          </div>
                          <div>
                            <div className="text-body font-medium text-text-primary">
                              {(m.first_name || m.last_name)
                                ? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim()
                                : "—"}
                              {m.id === user?.id && (
                                <span className="ml-2 text-helper text-helper">(you)</span>
                              )}
                            </div>
                            <div className="text-helper text-helper">{m.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Licensed products */}
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(m.licensed_classes ?? []).map((cls) => (
                            <span
                              key={cls}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium ${CLASS_COLOURS[cls] ?? "bg-silver text-text-primary"}`}
                            >
                              {CLASS_OPTIONS.find((c) => c.key === cls)?.label ?? cls}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4 hidden lg:table-cell">
                        {m.is_admin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-navy/10 text-navy text-[11px] font-medium">
                            <Shield className="h-3 w-3" /> Admin
                          </span>
                        ) : (
                          <span className="text-body text-text-primary capitalize">
                            {m.role ?? "Broker"}
                          </span>
                        )}
                      </td>

                      {/* Last login */}
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <span className="text-body text-helper">{formatDate(m.last_login)}</span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            m.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-silver text-helper"
                          }`}
                        >
                          {m.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded hover:bg-silver transition-colors">
                                <MoreHorizontal className="h-4 w-4 text-helper" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(m)}>
                                Edit permissions
                              </DropdownMenuItem>
                              {m.id !== user?.id && (
                                <DropdownMenuItem
                                  onClick={() => handleToggleActive(m)}
                                  className={m.is_active ? "text-red-600 focus:text-red-600" : ""}
                                >
                                  {m.is_active ? "Deactivate" : "Reactivate"}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Invite dialog ──────────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
          </DialogHeader>
          <MemberFormFields
            form={inviteForm}
            onChange={(updates) => setInviteForm((f) => ({ ...f, ...updates }))}
            isEdit={false}
            isSelf={false}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={inviteSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteSubmitting}>
              {inviteSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!editMember} onOpenChange={(open) => { if (!open) setEditMember(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit permissions</DialogTitle>
            {editMember && (
              <p className="text-helper text-helper pt-1">
                {editMember.email}
              </p>
            )}
          </DialogHeader>
          <MemberFormFields
            form={editForm}
            onChange={(updates) => setEditForm((f) => ({ ...f, ...updates }))}
            isEdit={true}
            isSelf={editMember?.id === user?.id}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditMember(null)}
              disabled={editSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editSubmitting}>
              {editSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminPage;
