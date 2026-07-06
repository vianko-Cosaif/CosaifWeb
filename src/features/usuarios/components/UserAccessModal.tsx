"use client";

import { AlertCircle } from "lucide-react";
import { Button, Modal, cn } from "@/app/Components/ui";
import type { UserData } from "../types";

type UserAccessModalProps = {
  user: UserData;
  onClose: () => void;
  onConfirm: (user: UserData) => void;
};

export default function UserAccessModal({ user, onClose, onConfirm }: UserAccessModalProps) {
  const disabling = Boolean(user.activo);

  return (
    <Modal
      title={disabling ? "Desactivar acceso" : "Reactivar acceso"}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div
          className={cn(
            "rounded-lg border p-4",
            disabling
              ? "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30"
              : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          )}
        >
          <div className="flex gap-3">
            <AlertCircle
              className={cn(
                "h-5 w-5 shrink-0",
                disabling ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              )}
              aria-hidden
            />
            <div
              className={cn(
                "text-sm",
                disabling ? "text-rose-900 dark:text-rose-100" : "text-emerald-900 dark:text-emerald-100"
              )}
            >
              <p className="font-black">
                {disabling ? "Se negara el acceso inmediatamente" : "El usuario podra iniciar sesion de nuevo"}
              </p>
              <p className="mt-1">
                {disabling ? (
                  <>
                    Al desactivar a <span className="font-black">{user.nombre}</span>, se cierran sus sesiones
                    activas y sus tokens dejan de ser validos.
                  </>
                ) : (
                  <>
                    Quieres reactivar el acceso de <span className="font-black">{user.nombre}</span>?
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button type="button" onClick={onClose} variant="secondary" className="flex-1">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(user)}
            variant={disabling ? "danger" : "success"}
            className="flex-1"
          >
            {disabling ? "Desactivar" : "Reactivar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
