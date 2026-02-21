"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  label?: string;
  fallbackHref?: string;
  className?: string;
};

export function BackButton({
  label = "Back",
  fallbackHref = "/",
  className,
}: BackButtonProps) {
  const router = useRouter();

  function onBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={onBack}
      className={className ?? "border rounded px-3 py-2 text-sm"}
    >
      ← {label}
    </button>
  );
}