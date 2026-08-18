"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  MapPin,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";
import { Button, SelectField, cn } from "@/app/Components/ui";
import { ROLE_LABELS, isCompanyAllowedForRole, isRoleAllowedForCompany, roleAccent } from "../constants";
import type { Empresa, Localidad, Rol, UserData, UserFormValues } from "../types";
import { passwordScore } from "../utils";

type UserFormProps = {
  mode: "create" | "edit";
  empresas: Empresa[];
  localidades: Localidad[];
  roleOptions: Rol[];
  lockLocalidad?: boolean;
  initial?: UserData;
  onSubmit: (values: UserFormValues) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  nombre: string;
  email: string;
  rol: Rol;
  empresaId: number | "";
  localidadId: number | "";
  password: string;
  confirm: string;
};

export default function UserForm({
  mode,
  empresas,
  localidades,
  roleOptions,
  lockLocalidad = false,
  initial,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const [form, setForm] = useState<FormState>(() => ({
    nombre: initial?.nombre ?? "",
    email: initial?.email ?? "",
    rol: initial?.rol ?? "CLIENTE",
    empresaId: initial?.empresaId ?? (empresas[0]?.id ?? ""),
    localidadId: initial?.localidad?.id ?? initial?.localidadId ?? (localidades[0]?.id ?? ""),
    password: "",
    confirm: "",
  }));
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({
    nombre: false,
    email: false,
    password: false,
    confirm: false,
  });

  const passwordDraft = form.password || "";
  const confirmDraft = form.confirm || "";
  const wantsPasswordChange = mode === "edit" && (passwordDraft.length > 0 || confirmDraft.length > 0);
  const passwordRequired = mode === "create";
  const shouldValidatePassword = passwordRequired || wantsPasswordChange;
  const passwordReady = !shouldValidatePassword || (passwordDraft.length >= 8 && passwordDraft === confirmDraft);
  const pScore = useMemo(() => passwordScore(passwordDraft), [passwordDraft]);
  const accent = roleAccent(form.rol);
  const selectedEmpresa = useMemo(
    () => empresas.find((empresa) => Number(empresa.id) === Number(form.empresaId)),
    [empresas, form.empresaId]
  );
  const compatibleRoleOptions = useMemo(
    () => roleOptions.filter((role) => isRoleAllowedForCompany(role, selectedEmpresa?.nombre)),
    [roleOptions, selectedEmpresa?.nombre]
  );
  const compatibleEmpresas = useMemo(
    () => empresas.filter((empresa) => isCompanyAllowedForRole(empresa.nombre, form.rol)),
    [empresas, form.rol]
  );
  const businessRuleMessage = !selectedEmpresa
    ? ""
    : !isRoleAllowedForCompany(form.rol, selectedEmpresa.nombre)
      ? "La empresa seleccionada no es compatible con el rol elegido."
      : "";

  useEffect(() => {
    if (compatibleRoleOptions.length && !compatibleRoleOptions.includes(form.rol)) {
      setForm((current) => ({ ...current, rol: compatibleRoleOptions[0] }));
    }
  }, [compatibleRoleOptions, form.rol]);

  useEffect(() => {
    if (!compatibleEmpresas.length) return;
    if (!compatibleEmpresas.some((empresa) => Number(empresa.id) === Number(form.empresaId))) {
      setForm((current) => ({ ...current, empresaId: compatibleEmpresas[0].id }));
    }
  }, [compatibleEmpresas, form.empresaId]);

  const passwordStatusMessage =
    shouldValidatePassword && passwordDraft.length > 0 && passwordDraft.length < 8
      ? "La contraseña debe tener minimo 8 caracteres."
      : shouldValidatePassword && passwordDraft.length >= 8 && passwordDraft !== confirmDraft
      ? "Confirma la misma contraseña para poder guardar."
      : "";

  const errors = {
    nombre: touched.nombre && !form.nombre.trim() ? "El nombre es obligatorio" : "",
    email: touched.email && !form.email.trim() ? "El email es obligatorio" : "",
    password:
      touched.password && passwordRequired && !passwordDraft.trim()
        ? "La contraseña es obligatoria"
        : touched.password && shouldValidatePassword && passwordDraft.length < 8
        ? "Minimo 8 caracteres"
        : "",
    confirm:
      touched.confirm && shouldValidatePassword && passwordDraft !== confirmDraft
        ? "Las contraseñas no coinciden"
        : "",
    empresa: !form.empresaId ? "Selecciona una empresa" : "",
    localidad: !form.localidadId ? "Selecciona una localidad" : "",
  };

  const canSubmit =
    form.nombre.trim() &&
    form.email.trim() &&
    !!form.empresaId &&
    !!form.localidadId &&
    !businessRuleMessage &&
    passwordReady &&
    !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSubmit({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        rol: form.rol,
        empresaId: Number(form.empresaId),
        localidadId: Number(form.localidadId),
        password: passwordDraft.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const baseInput =
    "w-full rounded-xl border px-3.5 py-3 pl-11 text-sm shadow-sm transition focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100";
  const okCls = "border-slate-300 focus:border-sky-500 focus:ring-sky-500/20 dark:border-slate-700";
  const errCls = "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20";

  return (
    <div className="space-y-5">
      <div className={cn("rounded-2xl border p-4 shadow-sm dark:border-slate-700", `ring-2 ${accent.ring}`)}>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black dark:bg-slate-800",
            accent.text
          )}
        >
          <UserIcon className="h-4 w-4" aria-hidden />
          {mode === "create" ? "Crear Nuevo Usuario" : "Editar Usuario"}
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {mode === "create"
            ? "Define los datos de acceso, rol y ubicacion del nuevo usuario."
            : "Actualiza acceso, rol, empresa, localidad o contraseña. Los cambios sensibles cierran sesiones vigentes."}
        </p>
      </div>

      <div className="relative">
        <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={form.nombre}
          onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
          onBlur={() => setTouched((current) => ({ ...current, nombre: true }))}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          className={cn(baseInput, errors.nombre ? errCls : okCls)}
          placeholder="Usuario / nombre de acceso"
          autoComplete="username"
        />
        {errors.nombre ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.nombre}</p> : null}
      </div>

      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          onBlur={() => setTouched((current) => ({ ...current, email: true }))}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          className={cn(baseInput, errors.email ? errCls : okCls)}
          placeholder="correo@empresa.com"
          autoComplete="email"
        />
        {errors.email ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.email}</p> : null}
      </div>

      {mode === "edit" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex gap-3">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-black">Cambio de contraseña opcional</p>
              <p className="mt-0.5 text-xs opacity-80">
                Escribe una contraseña nueva solo cuando necesites reemplazar la actual.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type={showPass ? "text" : "password"}
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, password: true }))}
            className={cn(baseInput, errors.password ? errCls : okCls, "pr-12")}
            placeholder={mode === "create" ? "Contraseña (minimo 8)" : "Nueva contraseña (opcional)"}
            autoComplete={mode === "create" ? "new-password" : "off"}
          />
          <button
            type="button"
            onClick={() => setShowPass((visible) => !visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPass ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
          {errors.password ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.password}</p> : null}
        </div>

        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type={showConfirm ? "text" : "password"}
            value={form.confirm}
            onChange={(event) => setForm((current) => ({ ...current, confirm: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, confirm: true }))}
            className={cn(baseInput, errors.confirm ? errCls : okCls, "pr-12")}
            placeholder="Confirmar contraseña"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((visible) => !visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={showConfirm ? "Ocultar confirmacion" : "Mostrar confirmacion"}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
          {errors.confirm ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.confirm}</p> : null}
        </div>
      </div>

      {mode === "create" || wantsPasswordChange ? (
        <>
          {passwordStatusMessage ? (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{passwordStatusMessage}</p>
          ) : null}
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Seguridad de la contraseña</span>
            <span className={cn(pScore < 40 ? "text-rose-600" : pScore < 70 ? "text-amber-600" : "text-emerald-600")}>
              {pScore}%
            </span>
          </div>
          <div className="h-2 w-full rounded bg-slate-200 dark:bg-slate-800">
            <div
              className={cn("h-2 rounded", pScore < 40 ? "bg-rose-500" : pScore < 70 ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${pScore}%` }}
            />
          </div>
        </>
      ) : null}

      <div>
        <label className="mb-1.5 block text-sm font-black text-slate-700 dark:text-slate-300">Rol</label>
        <div className="grid grid-cols-2 gap-2">
          {compatibleRoleOptions.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setForm((current) => ({ ...current, rol: role }))}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-black transition",
                form.rol === role
                  ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm ring-2 ring-sky-500/20 dark:bg-sky-950/50 dark:text-sky-300"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {ROLE_LABELS[role] ?? role}
            </button>
          ))}
        </div>
        {businessRuleMessage ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {businessRuleMessage}
          </p>
        ) : null}
        {mode === "edit" ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Cambiar rol, empresa o localidad obliga a iniciar sesion de nuevo.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Empresa"
          icon={<Building className="h-4 w-4" aria-hidden />}
          value={form.empresaId}
          error={!form.empresaId ? errors.empresa : undefined}
          className="h-[46px] rounded-xl"
          onChange={(event) =>
            setForm((current) => ({ ...current, empresaId: event.target.value ? Number(event.target.value) : "" }))
          }
        >
          <option value="">Selecciona una empresa</option>
          {compatibleEmpresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Localidad"
          icon={<MapPin className="h-4 w-4" aria-hidden />}
          value={form.localidadId}
          error={!form.localidadId ? errors.localidad : undefined}
          className="h-[46px] rounded-xl"
          disabled={lockLocalidad}
          onChange={(event) =>
            setForm((current) => ({ ...current, localidadId: event.target.value ? Number(event.target.value) : "" }))
          }
        >
          <option value="">Selecciona una localidad</option>
          {localidades.map((localidad) => (
            <option key={localidad.id} value={localidad.id}>
              {localidad.nombre}
              {localidad.estado ? `, ${localidad.estado}` : ""}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="flex gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
        <Button type="button" onClick={onCancel} variant="secondary" size="lg" className="flex-1">
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          size="lg"
          className={cn("flex-1 border-0 bg-gradient-to-r text-white shadow-lg hover:shadow-xl", accent.grad)}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              {mode === "create" ? "Creando..." : "Guardando..."}
            </span>
          ) : mode === "create" ? (
            "Crear Usuario"
          ) : (
            "Guardar Cambios"
          )}
        </Button>
      </div>
    </div>
  );
}
