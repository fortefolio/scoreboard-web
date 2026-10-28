"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, supabase } = useAuth();
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("username, subscription_tier")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && data) {
        setUsername(data.username || "");
        setInitialUsername(data.username || "");
        setSubscriptionTier(data.subscription_tier || "free");
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user, supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmed = username.trim();
    if (!trimmed) {
      toast.error("Username cannot be empty");
      return;
    }

    if (trimmed === initialUsername) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .ilike("username", trimmed)
        .neq("id", user.id)
        .maybeSingle();

      if (existingUser) {
        toast.error("Username already taken. Please choose another one.");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("users")
        .update({ username: trimmed, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) {
        toast.error(`Failed to update profile: ${error.message}`);
      } else {
        setInitialUsername(trimmed);
        setUsername(trimmed);
        toast.success("Profile updated successfully!");
      }
    } catch {
      toast.error("An unexpected error occurred while saving your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="text-secondary font-label text-xs uppercase tracking-[0.2em] mb-2">Account Configuration</p>
          <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-surface">SETTINGS</h1>
        </header>

        <div className="bg-surface-container-low rounded-[2.5rem] p-8 md:p-12 border border-outline-variant/10 shadow-3xl space-y-8">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ""}
                className="w-full px-6 py-4 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface-variant font-bold opacity-60 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a unique username"
                className="w-full px-6 py-4 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">
                Subscription Tier
              </label>
              <div className="inline-flex items-center gap-3 px-5 py-3 bg-surface-container rounded-2xl border border-outline-variant/10">
                <span className={`w-2.5 h-2.5 rounded-full ${subscriptionTier === "pro" ? "bg-emerald-500" : "bg-indigo-400"}`}></span>
                <span className="text-xs font-black uppercase tracking-widest text-on-surface">
                  {subscriptionTier.toUpperCase()} PLAN
                </span>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-container text-on-primary-container px-8 py-4 rounded-full font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-primary-container/20 disabled:opacity-50 active:scale-95"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
