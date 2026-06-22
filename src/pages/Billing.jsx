import React, { useEffect, useState } from "react";
import { CreditCard, Coins } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";

export default function Billing() {
  const { user } = useAuth();
  const [tokenBalance, setTokenBalance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadBalance = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("prepaid_token_balance")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      setTokenBalance(data?.prepaid_token_balance ?? 0);
    } catch (error) {
      toast({ title: "Couldn't load token balance", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-heading text-foreground tracking-tight">
          Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your token balance and payment methods.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-6 shadow-lg shadow-black/[0.03]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center mb-4">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Prepaid Token Balance
          </p>
          {isLoading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className="text-3xl font-semibold font-heading text-foreground mt-1">
              {tokenBalance}
            </p>
          )}
        </div>

        <div className="glass rounded-2xl p-6 shadow-lg shadow-black/[0.03]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center mb-4">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Payment Method
          </p>
          <p className="text-base font-medium text-foreground mt-2">
            No payment method on file
          </p>
          <Button variant="outline" className="mt-3 rounded-xl text-sm">
            Add Payment Method
          </Button>
        </div>
      </div>
    </div>
  );
}
