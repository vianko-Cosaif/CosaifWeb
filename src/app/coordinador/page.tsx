"use client";

import React, { useEffect, useState } from "react";
import SidebarMenu, { Rol } from "@/app/Components/Menu/Menu";
import RailQueueBoard from "./RailQueueBoard";
import { getClientCookie, setClientCookie } from "@/lib/cookies";

const CoordinadorPage: React.FC = () => {
  const rol: Rol = "COORDINADOR";

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
    <div className="relative flex min-h-svh bg-gradient-to-b from-emerald-50 to-sky-50 dark:from-zinc-900 dark:to-zinc-950">
      {/* Sidebar */}

      {/* Contenido principal */}
      <div className="relative z-10 flex min-h-svh flex-1 flex-col">
        <main className="mx-auto w-full max-w-screen-2xl flex-1 p-4 sm:p-6 md:p-8">
          {localidadId && (
            <div className="w-full py-4">
              <RailQueueBoard localidadId={localidadId} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default CoordinadorPage;
