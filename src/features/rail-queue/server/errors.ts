import "server-only";

export class RondasReadError extends Error {
  constructor(public readonly status: 401 | 403 | 502 | 504) {
    super("No se pudieron consultar las rondas del servicio de operación.");
    this.name = "RondasReadError";
  }
}
