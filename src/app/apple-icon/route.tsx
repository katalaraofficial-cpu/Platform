import { fetchKatalaraLogo } from "../_brand-logo";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET() {
  return fetchKatalaraLogo();
}
