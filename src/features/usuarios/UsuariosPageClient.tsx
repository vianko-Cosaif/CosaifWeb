"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Filter, Plus, RefreshCw, Users } from "lucide-react";
import {
  Button,
  DataEmptyState,
  FilterPanel,
  LoadingState,
  Modal,
  ModuleHeader,
  SearchInput,
  SelectField,
} from "@/app/Components/ui";
import { fetchJSON } from "./api";
import {
  ADMIN_ROLE_OPTIONS,
  LOCAL_COORDINATOR_ROLE_OPTIONS,
  ROLE_LABELS,
  USER_ROLE_OPTIONS,
} from "./constants";
import UserAccessModal from "./components/UserAccessModal";
import UserCard from "./components/UserCard";
import UserForm from "./components/UserForm";
import UserToastContainer from "./components/UserToastContainer";
import type {
  Empresa,
  Localidad,
  Rol,
  Toast,
  ToastType,
  UserData,
  UserFilterActivo,
  UserFormValues,
} from "./types";
import { getCookie, isGdlLocalidad } from "./utils";

type UsuariosPageClientProps = {
  apiBase?: string;
};

export default function UsuariosPageClient({
  apiBase = process.env.NEXT_PUBLIC_API_BASE || "/bff",
}: UsuariosPageClientProps) {
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();
  const [q, setQ] = useState("");
  const [filterRol, setFilterRol] = useState<Rol | "">("");
  const [filterActivo, setFilterActivo] = useState<UserFilterActivo>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<UserData>();
  const [creating, setCreating] = useState(false);
  const [statusTarget, setStatusTarget] = useState<UserData>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const abortRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => abortRef.current?.abort(), []);

  const actorRole = getCookie("role").toUpperCase();
  const actorLocalidadId = Number(getCookie("locId") || Number.NaN);
  const actorLocalidad = localidades.find((localidad) => localidad.id === actorLocalidadId);
  const canManageAdministrators = actorRole === "ADMINISTRADOR";
  const restrictedLocalCoordinator = actorRole === "COORDINADOR" && !isGdlLocalidad(actorLocalidad?.nombre);

  const roleOptions = useMemo(() => {
    if (canManageAdministrators) return ADMIN_ROLE_OPTIONS;
    if (restrictedLocalCoordinator) return LOCAL_COORDINATOR_ROLE_OPTIONS;
    return USER_ROLE_OPTIONS;
  }, [canManageAdministrators, restrictedLocalCoordinator]);

  const formLocalidades = useMemo(() => {
    if (restrictedLocalCoordinator && Number.isFinite(actorLocalidadId)) {
      return localidades.filter((localidad) => localidad.id === actorLocalidadId);
    }
    return localidades;
  }, [actorLocalidadId, localidades, restrictedLocalCoordinator]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 5000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(undefined);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const [list, emps, locs] = await Promise.all([
        fetchJSON<UserData[]>(`${apiBase}/usuarios`, { signal: controller.signal }),
        fetchJSON<Empresa[]>(`${apiBase}/empresas`, { signal: controller.signal }).catch(() => [] as Empresa[]),
        fetchJSON<Localidad[]>(`${apiBase}/localidades`, { signal: controller.signal }).catch(() => [] as Localidad[]),
      ]);
      setUsuarios(Array.isArray(list) ? list : []);
      setEmpresas(Array.isArray(emps) ? emps : []);
      setLocalidades(Array.isArray(locs) ? locs : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al cargar datos";
      setErr(message);
      setUsuarios([]);
      addToast("error", message);
    } finally {
      setLoading(false);
    }
  }, [addToast, apiBase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return usuarios.filter((usuario) => {
      const matchSearch =
        !key ||
        usuario.nombre.toLowerCase().includes(key) ||
        usuario.email.toLowerCase().includes(key) ||
        usuario.rol.toLowerCase().includes(key) ||
        (usuario.empresa?.nombre || "").toLowerCase().includes(key) ||
        (usuario.localidad?.nombre || "").toLowerCase().includes(key);
      const matchRol = !filterRol || usuario.rol === filterRol;
      const matchActivo =
        filterActivo === "all" ||
        (filterActivo === "active" && usuario.activo) ||
        (filterActivo === "inactive" && !usuario.activo);
      return matchSearch && matchRol && matchActivo;
    });
  }, [filterActivo, filterRol, q, usuarios]);

  const activeFiltersCount = [filterRol, filterActivo !== "all"].filter(Boolean).length;

  const clearFilters = () => {
    setFilterRol("");
    setFilterActivo("all");
    setQ("");
  };

  async function saveEdit(user: UserData & { password?: string }) {
    try {
      const nextPassword = String(user.password || "").trim();
      const body: {
        nombre: string;
        usuario: string;
        email: string;
        rol: Rol;
        empresaId: number;
        localidadId: number;
        contrasena?: string;
      } = {
        nombre: String(user.nombre || "").trim(),
        usuario: String(user.nombre || "").trim(),
        email: String(user.email || "").trim(),
        rol: user.rol,
        empresaId: Number(user.empresaId),
        localidadId: Number(user.localidad?.id ?? user.localidadId),
      };
      if (nextPassword) body.contrasena = nextPassword;

      await fetchJSON<unknown>(`${apiBase}/usuarios/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      addToast(
        "success",
        nextPassword ? "Usuario y contraseña actualizados correctamente" : "Usuario actualizado correctamente"
      );
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Error al actualizar");
      throw error;
    }
  }

  async function createUser(values: UserFormValues) {
    try {
      await fetchJSON<unknown>(`${apiBase}/usuarios`, {
        method: "POST",
        body: JSON.stringify({
          nombre: values.nombre.trim(),
          usuario: values.nombre.trim(),
          email: values.email.trim(),
          contrasena: values.password,
          empresaId: Number(values.empresaId),
          rol: values.rol,
          localidadId: values.localidadId,
          activo: true,
        }),
      });
      addToast("success", "Usuario creado exitosamente");
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Error al crear");
      throw error;
    }
  }

  async function changeUserStatus(user: UserData) {
    try {
      const nextActivo = !user.activo;
      await fetchJSON<unknown>(`${apiBase}/usuarios/${user.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ activo: nextActivo }),
      });
      addToast("success", nextActivo ? "Acceso reactivado correctamente" : "Acceso desactivado y sesiones cerradas");
      setStatusTarget(undefined);
      await load();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Error al cambiar el acceso");
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)]">
      <ModuleHeader
        icon={Users}
        eyebrow="COSAIF"
        title="Gestion de Usuarios"
        subtitle="Administra accesos, permisos y localidades desde una sola vista"
        badge={`${filtered.length} visibles`}
        loading={loading}
        className="mb-6"
        actions={
          <>
            <Button onClick={() => load()} loading={loading} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}>
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            <Button
              onClick={() => setCreating(true)}
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            >
              Nuevo Usuario
            </Button>
          </>
        }
      />

      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Buscar por nombre, email, rol, empresa o localidad..."
            className="flex-1"
            label="Buscar usuarios"
          />
          <Button
            onClick={() => setShowFilters((value) => !value)}
            variant={showFilters || activeFiltersCount > 0 ? "success" : "secondary"}
            rightIcon={<Filter className="h-4 w-4" aria-hidden />}
          >
            Filtros
            {activeFiltersCount > 0 ? (
              <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">
                {activeFiltersCount}
              </span>
            ) : null}
          </Button>
        </div>

        {showFilters ? (
          <FilterPanel title="Filtros de usuarios" count={activeFiltersCount}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField label="Rol" value={filterRol} onChange={(event) => setFilterRol(event.target.value as Rol | "")}>
                  <option value="">Todos los roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
              </SelectField>

              <SelectField
                label="Estado"
                value={filterActivo}
                onChange={(event) => setFilterActivo(event.target.value as UserFilterActivo)}
              >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
              </SelectField>

              <div className="flex items-end">
                <Button onClick={clearFilters} variant="secondary" className="w-full">
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </FilterPanel>
        ) : null}
      </div>

      {loading ? (
        <LoadingState label="Cargando usuarios" className="min-h-[320px]" />
      ) : err ? (
        <DataEmptyState
          icon={AlertCircle}
          title={err}
          description="No se pudo cargar el catalogo de usuarios."
          actions={
            <Button onClick={load} variant="danger" leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}>
              Reintentar
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <DataEmptyState
          icon={Users}
          title="No se encontraron usuarios"
          description={
            q || filterRol || filterActivo !== "all"
              ? "Ajusta los filtros de busqueda."
              : "Comienza creando un nuevo usuario."
          }
          actions={
            q || filterRol || filterActivo !== "all" ? (
              <Button onClick={clearFilters} variant="secondary">
                Limpiar filtros
              </Button>
            ) : (
              <Button
                onClick={() => setCreating(true)}
                variant="primary"
                leftIcon={<Plus className="h-4 w-4" aria-hidden />}
              >
                Nuevo Usuario
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Mostrando <span className="font-black">{filtered.length}</span> de{" "}
              <span className="font-black">{usuarios.length}</span> usuarios
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((usuario, index) => (
              <UserCard
                key={usuario.id}
                user={usuario}
                index={index}
                onEdit={setEditing}
                onStatusChange={setStatusTarget}
              />
            ))}
          </div>
        </>
      )}

      {creating ? (
        <Modal title="Crear Nuevo Usuario" onClose={() => setCreating(false)}>
          <UserForm
            mode="create"
            empresas={empresas}
            localidades={formLocalidades}
            roleOptions={roleOptions}
            onSubmit={async (values) => {
              await createUser(values);
              setCreating(false);
              await load();
            }}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Editar Usuario" onClose={() => setEditing(undefined)}>
          <UserForm
            mode="edit"
            empresas={empresas}
            localidades={formLocalidades}
            roleOptions={roleOptions}
            initial={editing}
            onSubmit={async (values) => {
              await saveEdit({ ...editing, ...values, id: editing.id });
              setEditing(undefined);
              await load();
            }}
            onCancel={() => setEditing(undefined)}
          />
        </Modal>
      ) : null}

      {statusTarget ? (
        <UserAccessModal
          user={statusTarget}
          onClose={() => setStatusTarget(undefined)}
          onConfirm={changeUserStatus}
        />
      ) : null}

      <UserToastContainer
        toasts={toasts}
        onRemove={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />
    </div>
  );
}
