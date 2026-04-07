"use client";

import React, { useEffect, useState } from "react";
import RailQueueBoard from "./RailQueueBoard";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
import { getClientCookie, setClientCookie } from "@/lib/cookies";

const CoordinadorPage: React.FC = () => {
  const [localidadId, setLocalidadId] = useState<number | null>(null);

  useEffect(() => {
    const raw =
      getClientCookie("locId") ??
      (typeof window !== "undefined" ? localStorage.getItem("locId") : null);

    let num = raw ? Number(raw) : NaN;

    // si no hay locId válido, usamos 1 y lo dejamos grabado
    if (!Number.isFinite(num) || num <= 0) {
      num = 1;
      try {
        localStorage.setItem("locId", "1");
      } catch { }
      setClientCookie("locId", "1", {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    setLocalidadId(num);
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

export default CoordinadorPage;
