import React, { useEffect, useState } from "react";
import { Rocket, UserCircle, MessageSquare, Coins } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";

const STAT_CONFIG = [
  { key: "activePersonas", label: "Active Personas", icon: UserCircle, color: "from-primary to-blue-400" },
  { key: "runningCampaigns", label: "Running Campaigns", icon: Rocket, color: "from-accent to-violet-400" },
  { key: "messagesSent", label: "Messages Sent", icon: MessageSquare, color: "from-emerald-500 to-teal-400" },
  { key: "tokensRemaining", label: "Tokens Remaining", icon: Coins, color: "from-amber-500 to-orange-400" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [personasRes, campaignsRes, messagesRes, profileRes] = await Promise.all([
        supabase
          .from("personas")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "Active"),
        supabase
          .from("campaigns")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("prepaid_token_balance")
          .eq("id", user.id)
          .single(),
      ]);

      if (personasRes.error) throw personasRes.error;
      if (campaignsRes.error) throw campaignsRes.error;
      if (messagesRes.error) throw messagesRes.error;
      if (profileRes.error) throw profileRes.error;

      setStats({
        activePersonas: personasRes.count ?? 0,
        runningCampaigns: campaignsRes.count ?? 0,
        messagesSent: messagesRes.count ?? 0,
        tokensRemaining: profileRes.data?.prepaid_token_balance ?? 0,
      });
    } catch (error) {
      toast({ title: "Couldn't load dashboard stats", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-heading text-foreground tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your engagement engine activity.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {STAT_CONFIG.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className="glass rounded-2xl p-5 shadow-lg shadow-black/[0.03] hover:shadow-xl hover:shadow-black/[0.06] transition-shadow duration-300"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mb-1" />
              ) : (
                <p className="text-2xl font-semibold font-heading text-foreground">
                  {stats?.[stat.key]}
                </p>
              )}
              <p className="text-xs text-muted-foreground font-medium mt-1">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 glass rounded-2xl p-6 shadow-lg shadow-black/[0.03]">
        <h2 className="text-lg font-semibold font-heading text-foreground mb-2">
          Getting Started
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Create your first persona in the Persona Builder, then launch a campaign to begin automated engagement.
        </p>
      </div>
    </div>
  );
}
