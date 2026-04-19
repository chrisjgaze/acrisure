import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FormInput from "@/components/FormInput";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const LoginPage: React.FC = () => {
  const { signIn, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  if (isLoading) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sign in failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-silver/50 px-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-card rounded-lg shadow-card p-8">
          <div className="flex justify-center mb-8">
            <img src="/acrisure-logo-black.svg" alt="Acrisure" className="h-10 w-auto" />
          </div>

          <form onSubmit={handleSubmit}>
            <FormInput
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              required
            />
            <FormInput
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              showPasswordToggle
              placeholder="Enter your password"
              required
            />

            {error && (
              <div className="mb-4 p-3 bg-[hsl(0,92%,95%)] border border-error-red/20 rounded-md">
                <p className="text-helper text-error-red">{error}</p>
              </div>
            )}

            <Button type="submit" size="full" loading={loading}>
              Sign in
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button variant="ghost" className="text-helper">
              Forgot your password?
            </Button>
          </div>
        </div>

        <p className="text-center text-helper text-helper mt-6">
          Acrisure FormFlow
        </p>
      </div>
    </div>
  );
};

export default LoginPage;