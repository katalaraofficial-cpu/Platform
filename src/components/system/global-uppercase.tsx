"use client";

import { useEffect } from "react";

const TEXT_INPUT_TYPES = new Set(["text", "search", "tel", "url", ""]);

function shouldSkip(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el.dataset.noUppercase !== undefined) return true;
  const ac = (el.autocomplete || "").toLowerCase();
  if (ac.includes("email") || ac.includes("password") || ac.includes("current-password") || ac.includes("new-password")) return true;
  const name = (el.name || "").toLowerCase();
  if (name.includes("email") || name.includes("password")) return true;
  const id = (el.id || "").toLowerCase();
  if (id.includes("email") || id.includes("password")) return true;
  return false;
}

function transform(el: HTMLInputElement | HTMLTextAreaElement) {
  const v = el.value;
  const up = v.toUpperCase();
  if (v === up) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.value = up;
  try {
    if (start !== null && end !== null) el.setSelectionRange(start, end);
  } catch {
    // ignore (some input types disallow selection range)
  }
}

export function GlobalUppercase() {
  useEffect(() => {
    function handler(e: Event) {
      const t = e.target;
      if (t instanceof HTMLTextAreaElement) {
        if (shouldSkip(t)) return;
        transform(t);
        return;
      }
      if (t instanceof HTMLInputElement) {
        const type = (t.type || "").toLowerCase();
        if (!TEXT_INPUT_TYPES.has(type)) return;
        if (shouldSkip(t)) return;
        transform(t);
      }
    }
    document.addEventListener("input", handler, true);
    return () => document.removeEventListener("input", handler, true);
  }, []);
  return null;
}
