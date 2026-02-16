import { useEffect } from 'react';
import {
  MovementFormData, FETCH_TIMEOUT_MS, Via, Servicio
} from './movimientos.shared'; // Mantén los tipos para el tipado fuerte

export class Movimiento {
  // Constantes Estáticas (No cambian entre instancias)
  static readonly CONFIG = {
    API_BASE: process.env.NEXT_PUBLIC_API_URL || "/xapi",
    DRAFT_KEY: "movement_draft_v3",
    TIMEOUT: 12000,
  } as const;

  static readonly PASSWORDS: Record<number, string> = {
    1: "ALTA-EMPRESA-1",
    2: "ALTA-EMPRESA-2",
  };

  // El estado inicial como un método estático que devuelve un objeto nuevo
  static get INITIAL_FORM(): MovementFormData {
    return {
      empresaId: null,
      locomotiveNumber: '',
      priority: false,
      fromTrack: null,
      toTrack: null,
      cabinPosition: 'Sin_Solicitar',
      chimneyPosition: 'Sin_Solicitar',
      polo: 'Sin_Solicitar',
      pushPull: '',
      movementType: '',
      comments: '',
      creadoPorId: null,
      clienteId: null,
      fechaInicio: '',
      fechaFin: ''
    };
  }

  // Métodos de utilidad (Lógica de negocio)
  static getBaseRoute(role?: string): string {
    const routes: Record<string, string> = {
      ADMINISTRADOR: "/administrador",
      COORDINADOR: "/coordinador",
      CLIENTE: "/cliente",
    };
    return routes[String(role).toUpperCase()] || "/cliente";
  }

  static prepareData(data: MovementFormData): MovementFormData {
    return {
      ...data,
      locomotiveNumber: data.locomotiveNumber.trim().toUpperCase(),
      fechaInicio: new Date(data.fechaInicio).toISOString(),
    };
  }
  static clsx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");
  static pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  static toInputDT = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    return `${d.getFullYear()}-${Movimiento.pad2(d.getMonth() + 1)}-${Movimiento.pad2(d.getDate())}T${Movimiento.pad2(d.getHours())}:${Movimiento.pad2(d.getMinutes())}`;
  };
  static fromInputDT = (v: string) => (v ? new Date(v).toISOString() : new Date().toISOString());

  static safeJSON = (t: string) => { try { return JSON.parse(t); } catch { return null; } };

  static getCookie = (name: string) => {
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[2]) : "";
  };
  static tokenHeader = (): HeadersInit => {
    const t = Movimiento.getCookie("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  static fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(to);
    }
  };

  static fetchJSON = async (url: string, init: RequestInit = {}) => {
    const isGet = !init.method || init.method.toUpperCase() === "GET";
    const res = await Movimiento.fetchWithTimeout(url, {
      credentials: "include",
      cache: "no-store",
      ...init,
      headers: {
        ...(isGet ? {} : { "Content-Type": "application/json" }),
        Accept: "application/json",
        ...(init.headers as any),
        ...Movimiento.tokenHeader(),
      },
    });
    const ct = res.headers.get("content-type") || "";
    const txt = await res.text().catch(() => "");
    const body = ct.includes("application/json") && txt ? Movimiento.safeJSON(txt) : null;
    if (!res.ok) throw new Error((body as any)?.message || (body as any)?.error || txt || `HTTP ${res.status}`);
    return body;
  };

  static useVisibleInterval(cb: () => void, ms: number | null) {
    useEffect(() => {
      if (!ms) return;
      const id = window.setInterval(() => { if (document.visibilityState === "visible") cb(); }, ms);
      const onVis = () => document.visibilityState === "visible" && cb();
      document.addEventListener("visibilitychange", onVis);
      return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    }, [cb, ms]);
  }
  static TrackFilter(vias: Via[] | any[], selected: String, filter: string, service: Servicio | undefined): Via[] {
    return vias
      .filter(v => {
        const viaNameLower = v.nombre.toLowerCase();
        if (service === '' && ['lavado', 'torno'].includes(viaNameLower)) {
          return false;
        }
        // If in de_via mode and service is lavado, only show vias that are not lavado
        if (selected === filter && service === 'Lavado') {
          return viaNameLower !== 'lavado';
        }
        // If in de_via mode and service is torno, only show vias that are not torno
        if (selected === filter && service === 'Torno') {
          return viaNameLower !== 'torno';
        }
        return true;
      });
  }
}

export default Movimiento;