"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { sanitizeInactiveAgentEmail } from "@/lib/agentEmail";

const MIN_PASSWORD_LENGTH = 6;

interface AgentCredentialsDialogProps {
  agent: { id: string; name: string; email: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the agent's login email after a successful change. */
  onUpdated: (email: string) => void;
}

const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
};

/** Lets an admin change an agent's login email and/or password. */
export default function AgentCredentialsDialog({
  agent,
  open,
  onOpenChange,
  onUpdated,
}: AgentCredentialsDialogProps) {
  const currentEmail = sanitizeInactiveAgentEmail(agent?.email);
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notifyAgent, setNotifyAgent] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Start clean each time the dialog opens.
  useEffect(() => {
    if (open) {
      setEmail(currentEmail);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setNotifyAgent(true);
    }
  }, [open, currentEmail]);

  const emailChanged =
    email.trim().length > 0 &&
    email.trim().toLowerCase() !== currentEmail.toLowerCase();
  const passwordChanged = password.length > 0;

  const handleGenerate = () => {
    const generated = generatePassword();
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;

    if (!emailChanged && !passwordChanged) {
      toast.error("Enter a new email or a new password.");
      return;
    }
    if (passwordChanged && password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    if (passwordChanged && password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`/api/agents/${agent.id}/credentials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailChanged ? email.trim() : undefined,
          password: passwordChanged ? password : undefined,
          notifyAgent,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || "Failed to update login details");
        return;
      }

      toast.success(`Login details updated for ${agent.name}.`);
      if (notifyAgent && !data.notified) {
        toast.warning("Saved, but the email to the agent could not be sent.");
      }
      onUpdated(data.email);
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating agent credentials:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Change login details</DialogTitle>
            <DialogDescription>
              Update the email and/or password {agent?.name} uses to log in to
              the agent portal. Leave the password blank to keep it. The agent
              is signed out and must log in again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="credentials-email">Login email</Label>
            <Input
              id="credentials-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="credentials-password">New password</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs cursor-pointer"
                onClick={handleGenerate}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Generate
              </Button>
            </div>
            <div className="relative">
              <Input
                id="credentials-password"
                type={showPassword ? "text" : "password"}
                placeholder="Leave blank to keep current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {passwordChanged && (
            <div className="space-y-2">
              <Label htmlFor="credentials-confirm">Confirm new password</Label>
              <Input
                id="credentials-confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          <div className="flex items-start gap-2">
            <Checkbox
              id="credentials-notify"
              checked={notifyAgent}
              onCheckedChange={(checked) => setNotifyAgent(checked === true)}
            />
            <Label htmlFor="credentials-notify" className="text-sm font-normal leading-snug">
              Email the new login details to the agent
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || (!emailChanged && !passwordChanged)}
              className="bg-[#003459] hover:bg-[#003459] text-white"
            >
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
