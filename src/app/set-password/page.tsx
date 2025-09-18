"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function SetPasswordShim() {
  const params = useSearchParams();
  useEffect(() => {
    const em = params.get("em") || "";
    const qs = new URLSearchParams();
    if (em) qs.set("em", em);
    const next = `/auth/recovery${qs.toString() ? `?${qs.toString()}` : ""}`;
    window.location.replace(next);
  }, [params]);
  return null;
}
