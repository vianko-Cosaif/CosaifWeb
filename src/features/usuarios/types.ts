"use client";

export type Rol =
  | "CLIENTE"
  | "CLIENTE_ADMIN"
  | "CLIENTE_COOR"
  | "ARRASTRE_TORREON"
  | "SUPERVISOR"
  | "COORDINADOR"
  | "ADMINISTRADOR"
  | "COMERCIAL"
  | "MAQUINISTA"
  | "MAQUINISTA_ARRASTRE"
  | "TORNO"
  | "LAVADO";

export type ID = number;

export interface Empresa {
  id: ID;
  nombre: string;
}

export interface Localidad {
  id: ID;
  nombre: string;
  estado?: string;
}

export interface UserData {
  id: ID;
  nombre: string;
  email: string;
  rol: Rol;
  empresaId: ID;
  localidadId?: ID;
  empresa?: { id?: ID; nombre: string };
  localidad?: { id?: ID; nombre: string; estado?: string };
  usuario?: string;
  activo?: boolean;
}

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export type UserFilterActivo = "all" | "active" | "inactive";

export type UserFormValues = {
  nombre: string;
  email: string;
  rol: Rol;
  empresaId: number;
  localidadId: number;
  password: string;
};
