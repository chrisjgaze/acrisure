import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";

/**
 * Wraps admin-only routes. Must be nested inside RequireAuth (so auth is
 * already resolved and isLoading is false by the time this renders).
 * Shows a 403 inline page if the user is not an admin.
 */
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-silver/30 flex items-center justify-center px-4">
        <div className="bg-card rounded-lg shadow-card p-10 max-w-sm w-full text-center">
          <div className="flex justify-center mb-4">
            <ShieldOff className="h-10 w-10 text-helper" />
          </div>
          <h2 className="mb-2">Access restricted</h2>
          <p className="text-body text-helper mb-6">
            This area is only accessible to admin users. Please contact your account administrator.
          </p>
          <Button onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAdmin;
