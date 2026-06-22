import React from "react";
import { CreditCard, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Billing() {
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
          <p className="text-3xl font-semibold font-heading text-foreground mt-1">
            —
          </p>
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