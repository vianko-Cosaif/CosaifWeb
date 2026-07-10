"use client";

import { Building, Edit2, Mail, MapPin, Power, PowerOff } from "lucide-react";
import { Button, cn } from "@/app/Components/ui";
import { ROLE_LABELS, roleBadge } from "../constants";
import type { UserData } from "../types";
import { userInitials } from "../utils";

type UserCardProps = {
  user: UserData;
  index?: number;
  onEdit: (user: UserData) => void;
  onStatusChange: (user: UserData) => void;
};

export default function UserCard({ user, index = 0, onEdit, onStatusChange }: UserCardProps) {
  return (
    <article
      className="group relative overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)] transition hover:border-[var(--app-border-strong)] hover:shadow-[var(--app-shadow-md)]"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div
        className={cn(
          "absolute right-0 top-0 h-1 w-full",
          user.activo
            ? "bg-[var(--app-accent)]"
            : "bg-[var(--app-border-strong)]"
        )}
      />
      <div className="p-4">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-base font-black text-white dark:bg-slate-200 dark:text-slate-900">
              {userInitials(user.nombre)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-black text-[var(--app-text)]">{user.nombre}</h3>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    user.activo ? "bg-emerald-500" : "bg-slate-400"
                  )}
                />
                {user.activo ? "Activo" : "Inactivo"}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="truncate text-[var(--app-text-muted)]">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Building className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="truncate text-[var(--app-text-muted)]">
              {user.empresa?.nombre || "Sin empresa"}
            </span>
          </div>
          {user.localidad ? (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span className="truncate text-[var(--app-text-muted)]">
                {user.localidad.nombre}
                {user.localidad.estado ? `, ${user.localidad.estado}` : ""}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black",
              roleBadge(user.rol)
            )}
          >
            {ROLE_LABELS[user.rol] ?? user.rol}
          </span>
        </div>

        <div className="mt-4 flex gap-2 border-t border-[var(--app-border)] pt-3">
          <Button
            onClick={() => onEdit(user)}
            variant="secondary"
            size="md"
            className="flex-1"
            title="Editar usuario"
          >
            <Edit2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            onClick={() => onStatusChange(user)}
            variant={user.activo ? "danger" : "success"}
            size="md"
            className="flex-1"
            title={user.activo ? "Desactivar acceso" : "Reactivar acceso"}
          >
            {user.activo ? <PowerOff className="h-4 w-4" aria-hidden /> : <Power className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      </div>
    </article>
  );
}
