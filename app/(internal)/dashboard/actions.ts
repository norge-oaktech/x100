"use server";

import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

export async function createProjectAction(formData: FormData) {
  const clientName = String(formData.get("clientName") || "").trim();
  const existingClientId = String(formData.get("existingClientId") || "");

  if (!clientName && !existingClientId) {
    return { error: "Provide a client name or pick an existing client." };
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  let clientId = existingClientId;

  if (!clientId) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({ name: clientName })
      .select("id")
      .single();

    if (clientError || !client) {
      return { error: clientError?.message ?? "Could not create client." };
    }
    clientId = client.id;
  }

  const slug = nanoid(21); // unguessable, used directly in the public URL

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      client_id: clientId,
      slug,
      status: "awaiting_onboarding",
      created_by: user.id,
    })
    .select("id, slug")
    .single();

  if (projectError || !project) {
    return { error: projectError?.message ?? "Could not create project." };
  }

  revalidatePath("/dashboard");
  return { success: true, slug: project.slug };
}
