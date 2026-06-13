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

// Set value via React-aware native setter so React's internal value tracker
// stays in sync. Without this, React may drop subsequent keystrokes on
// controlled inputs because its tracker disagrees with the DOM value.
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc && desc.set) {
    desc.set.call(el, value);
  } else {
    el.value = value;
  }
}

export function GlobalUppercase() {
  useEffect(() => {
    let composing = false;

    function maybeTransform(el: HTMLInputElement | HTMLTextAreaElement) {
      if (el instanceof HTMLInputElement) {
        const type = (el.type || "").toLowerCase();
        if (!TEXT_INPUT_TYPES.has(type)) return;
      }
      if (shouldSkip(el)) return;
      const v = el.value;
      const up = v.toUpperCase();
      if (v === up) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      setNativeValue(el, up);
      try {
        if (start !== null && end !== null) el.setSelectionRange(start, end);
      } catch {
        // ignore (some input types disallow selection range)
      }
    }

    function onInput(e: Event) {
      if (composing) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        maybeTransform(t);
      }
    }

    function onCompositionStart() {
      composing = true;
    }
    function onCompositionEnd(e: Event) {
      composing = false;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        maybeTransform(t);
      }
    }

    document.addEventListener("input", onInput, true);
    document.addEventListener("compositionstart", onCompositionStart, true);
    document.addEventListener("compositionend", onCompositionEnd, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("compositionstart", onCompositionStart, true);
      document.removeEventListener("compositionend", onCompositionEnd, true);
    };
  }, []);
  return null;
}
