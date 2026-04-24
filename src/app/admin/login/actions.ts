"use server";

import { createClient } from "@/lib/supabase/server";

export async function loginAction(
  _prevState: { error: string; ok?: boolean } | null,
  formData: FormData
): Promise<{ error: string; ok?: boolean }> {
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciales incorrectas" };
  }

  // Return ok:true so the client knows to navigate.
  // The session cookies are already committed to the response at this point,
  // so when the browser does window.location.href the middleware will see them.
  return { error: "", ok: true };
}
