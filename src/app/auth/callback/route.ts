import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback route — handles PKCE code exchange for:
 *  - Invite links  (type=invite)
 *  - Password reset (type=recovery)
 *  - Magic links    (type=magiclink)
 *
 * Supabase redirects to: {SITE_URL}/auth/callback?code=xxx&next=yyy
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/error?reason=auth_callback_failed`
  );
}
