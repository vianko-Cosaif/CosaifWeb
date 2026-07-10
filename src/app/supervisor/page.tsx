"use client";

import React, { useEffect, useState } from "react";
import RailQueueBoard from "./RailQueueBoard";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
import { getClientCookie } from "@/lib/cookies";
import { syncFirebaseNotificationLocalidad } from "@/lib/firebase";

const SupervisorPage: React.FC = () => {
  const [localidadId, setLocalidadId] = useState<number | null>(null);

  useEffect(() => {
    const raw =
      getClientCookie("locId") ??
      (typeof window !== "undefined" ? localStorage.getItem("locId") : null);

    const num = raw ? Number(raw) : NaN;
    if (!Number.isFinite(num) || num <= 0) return;

    setLocalidadId(num);
    window.dispatchEvent(new CustomEvent("cosaif:localidad-change", { detail: { localidadId: num } }));
    void syncFirebaseNotificationLocalidad(num).catch((error) => {
      console.warn("No se pudo sincronizar localidad FCM.", error);
    });
  }, []);

  return (
    <section className="w-full min-w-0">
      {localidadId && (
        <div className="mx-auto w-full max-w-[1400px] space-y-6 sm:space-y-8 min-w-0">
          <DynamicBanner />
          <RailQueueBoard localidadId={localidadId} />
        </div>
      )}
    </section>
  );
};

export default SupervisorPage;
