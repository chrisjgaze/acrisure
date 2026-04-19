import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const AuthCallbackPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth
      .exchangeCodeForSession(window.location.href)
      .finally(() => {
        navigate("/dashboard", { replace: true });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-silver/30">
      <p className="text-navy text-helper">Signing you in…</p>
    </div>
  );
};

export default AuthCallbackPage;
