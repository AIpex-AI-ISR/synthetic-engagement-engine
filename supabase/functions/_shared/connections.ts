export async function upsertConnection(
  supabase: any,
  userId: string,
  provider: string,
  status: string,
  externalLabel: string | null,
) {
  const data: Record<string, unknown> = { user_id: userId, provider, status };
  if (externalLabel) data.external_label = externalLabel;
  if (status === "connected") data.connected_at = new Date().toISOString();

  const { error } = await supabase
    .from("connections")
    .upsert(data, { onConflict: "user_id,provider" });
  if (error) throw error;
}
