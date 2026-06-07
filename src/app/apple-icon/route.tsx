import { renderKatalaraIcon } from "../_brand-icon";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET() {
  return renderKatalaraIcon({ size: 180 });
}
