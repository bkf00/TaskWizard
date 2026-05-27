"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  initialVersion: string;
  intervalMs?: number;
};

type VersionResponse = {
  version: string;
};

function userIsEditing(): boolean {
  const activeElement = document.activeElement;
  const activeTag = activeElement?.tagName.toLowerCase();
  const dialogOpen = Boolean(document.querySelector("dialog[open]"));
  const editOpen = Boolean(document.querySelector("details.edit[open]"));

  return dialogOpen || editOpen || activeTag === "input" || activeTag === "textarea" || activeTag === "select";
}

export function LiveDashboardRefresh({ initialVersion, intervalMs = 5000 }: Props) {
  const router = useRouter();
  const currentVersion = useRef(initialVersion);
  const pendingVersion = useRef<string | null>(null);
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false);

  useEffect(() => {
    async function checkForUpdates() {
      if (document.hidden) return;

      try {
        const response = await fetch("/api/state/version", {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        if (!response.ok) return;

        const payload = (await response.json()) as VersionResponse;
        if (!payload.version || payload.version === currentVersion.current) return;

        if (userIsEditing()) {
          pendingVersion.current = payload.version;
          setHasPendingUpdate(true);
          return;
        }

        currentVersion.current = payload.version;
        pendingVersion.current = null;
        setHasPendingUpdate(false);
        router.refresh();
      } catch {
        // A silent retry is enough; the dashboard should not distract users for transient polling errors.
      }
    }

    const timer = window.setInterval(() => {
      void checkForUpdates();
    }, intervalMs);

    void checkForUpdates();

    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs, router]);

  useEffect(() => {
    function applyPendingUpdate() {
      if (!pendingVersion.current || userIsEditing()) return;

      currentVersion.current = pendingVersion.current;
      pendingVersion.current = null;
      setHasPendingUpdate(false);
      router.refresh();
    }

    window.addEventListener("focus", applyPendingUpdate);
    document.addEventListener("focusout", applyPendingUpdate);
    document.addEventListener("toggle", applyPendingUpdate, true);

    return () => {
      window.removeEventListener("focus", applyPendingUpdate);
      document.removeEventListener("focusout", applyPendingUpdate);
      document.removeEventListener("toggle", applyPendingUpdate, true);
    };
  }, [router]);

  if (!hasPendingUpdate) return null;

  return (
    <div className="sync-banner" role="status">
      Exista actualizari noi. Inchide editarea curenta pentru refresh automat.
    </div>
  );
}
