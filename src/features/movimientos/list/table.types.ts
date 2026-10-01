import type { Movement, CampoOrden, DireccionOrden, Rol } from "./useMovimientos";

export interface TablaProps {
  puedeEditarFila?: (movement: Movement) => boolean;
  filas: Movement[];
  pagina: number;
  tamPagina: number;
  total: number;
  totalEstimado?: boolean;
  campoOrden: CampoOrden;
  direccionOrden: DireccionOrden;
  cargando?: boolean;
  onPagina: (p: number) => void;
  onOrden: (c: CampoOrden, d: DireccionOrden) => void;
  onEditar?: (id: number) => void;
  rol?: Rol;
  mostrarDuracion?: boolean;
}

