import React from "react";
import { Rocket, UserCircle, MessageSquare, Coins } from "lucide-react";

const stats = [
  { label: "Active Personas", value: "0", icon: UserCircle, color: "from-primary to-blue-400" },
  { label: "Running Campaigns", value: "0", icon: Rocket, color: "from-accent to-violet-400" },
  { label: "Messages Sent", value: "0", icon: MessageSquare, color: "from-emerald-500 to-teal-400" },
  { label: "Tokens Remaining", value: "—", icon: Coins, color: "from-amber-500 to-orange-400" },
];

export default function Dashboard() {
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
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="glass rounded-2xl p-5 shadow-lg shadow-black/[0.03] hover:shadow-xl hover:shadow-black/[0.06] transition-shadow duration-300"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-semibold font-heading text-foreground">
                {stat.value}
              </p>
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