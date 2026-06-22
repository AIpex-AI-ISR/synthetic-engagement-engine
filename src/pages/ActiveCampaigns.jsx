import React from "react";
import { Rocket, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ActiveCampaigns() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold font-heading text-foreground tracking-tight">
            Active Campaigns
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage your running engagement campaigns.
          </p>
        </div>
        <Button className="rounded-xl shadow-lg shadow-primary/20 gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </div>

      <div className="glass rounded-2xl p-12 shadow-lg shadow-black/[0.03] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <Rocket className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold font-heading text-foreground mb-1">
          No campaigns running
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Create a persona first, then launch a campaign to begin automated engagement.
        </p>
      </div>
    </div>
  );
}