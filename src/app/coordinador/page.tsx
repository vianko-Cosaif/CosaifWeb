"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
import { getClientCookie } from "@/lib/cookies";
import { syncFirebaseNotificationLocalidad } from "@/lib/firebase";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";

const RailQueueBoard = dynamic(() => import("./RailQueueBoard"));
const CoordinatorTorreonDashboard = dynamic(
  () => import("./torreon/CoordinatorTorreonDashboard")
);

const CoordinadorPage: React.FC = () => {
  const [localidadId, setLocalidadId] = useState<number | null>(null);

  useEffect(() => {
    const raw =
      getClientCookie("locId") ??
      (typeof window !== "undefined" ? window.localStorage.getItem("locId") : null);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    setLocalidadId(parsed);
    window.dispatchEvent(
      new CustomEvent("cosaif:localidad-change", { detail: { localidadId: parsed } })
    );
    void syncFirebaseNotificationLocalidad(parsed).catch((error) => {
      console.warn("No se pudo sincronizar localidad FCM.", error);
    });
  }, []);

  return (
    <section className="w-full min-w-0">
      {localidadId ? (
        <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-6 sm:space-y-8">
          <DynamicBanner />
          {isTorreonLocalidadId(localidadId) ? (
            <CoordinatorTorreonDashboard
              key={localidadId}
              localidadId={localidadId}
              showBanner={false}
            />
          ) : (
            <RailQueueBoard key={localidadId} localidadId={localidadId} />
          )}
        </div>
      ) : null}
    </section>
  );
};

export default CoordinadorPage;
