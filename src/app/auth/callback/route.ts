import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Auth callback route — handles two formats Supabase may use:
 *  1. PKCE code:   ?code=xxx          (OAuth + newer Supabase invites)
 *  2. OTP hash:    ?token_hash=xxx&type=invite|recovery|magiclink
 *
 * Supabase redirects to: {SITE_URL}/auth/callback?code=xxx&next=yyy
 *                     OR {SITE_URL}/auth/callback?token_hash=xxx&type=invite&next=yyy
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Implicit flow: Supabase embeds #access_token in the hash fragment.
  // Hash fragments are never sent to the server — redirect to a client page
  // that can read window.location.hash and create the session in the browser.
  const exchangeUrl = new URL(`${origin}/auth/exchange`);
  exchangeUrl.searchParams.set("next", next);
  return NextResponse.redirect(exchangeUrl.toString());
}
