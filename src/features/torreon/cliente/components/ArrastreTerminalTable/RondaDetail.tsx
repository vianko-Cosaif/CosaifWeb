import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import type { Arrastre, DailyInfo, VagonArrastre } from "../../../arrastres/types";
import { fmtDate, getArrastreTimeline } from "../../../arrastres/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import { isArrastreEditable, statusText } from "../../utils";
import { canMoveWithNeighbor, type Direction, orderedVagones, vagonLabel } from "./helpers";
import { RailRoute } from "../../../presentation/RailPrimitives";
import s from "../../../presentation/rail.module.scss";

type Props = {
  arrastre: Arrastre;
  dailyInfo?: DailyInfo;
  busyAction: string | null;
  onEditVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onReorderVagon?: (arrastre: Arrastre, vagon: VagonArrastre, direction: Direction) => void;
};
export function RondaDetail({ arrastre, busyAction, onEditVagon, onReorderVagon }: Props) {
  const vagones = orderedVagones(arrastre);
  const timeline = getArrastreTimeline(arrastre);
  const canChange = isArrastreEditable(arrastre.estado);
  return (
    <div className={s.detail} role="region" aria-label={`Vagones del arrastre ${arrastre.id}`}>
      <dl className={s.timeline}>
        <div>
          <dt>Solicitud</dt>
          <dd>{fmtDate(arrastre.fechaSolicitud)}</dd>
        </div>
        <div>
          <dt>Inicio</dt>
          <dd>{fmtDate(timeline.inicio)}</dd>
        </div>
        <div>
          <dt>Fin</dt>
          <dd>{fmtDate(timeline.fin)}</dd>
        </div>
      </dl>
      {arrastre.instrucciones ? (
        <p className={s.instructions}>
          <strong>Instrucciones · </strong>
          {arrastre.instrucciones}
        </p>
      ) : null}
      <div className={s.wagonsGrid}>
        {vagones.map((vagon, index) => {
          const editable =
            canChange && !["EN_PROCESO", "CONCLUIDO"].includes(statusText(vagon.estado));
          return (
            <article className={s.wagonCard} key={vagon.id}>
              <div className={s.wagonTop}>
                <div>
                  <small>
                    Vagón {vagon.orden} ·{" "}
                    {statusText(vagon.carga) === "LLENO"
                      ? "Lleno"
                      : statusText(vagon.carga) === "VACIO"
                        ? "Vacío"
                        : "Carga sin especificar"}
                  </small>
                  <strong>{vagonLabel(vagon)}</strong>
                </div>
                <StatusBadge status={vagon.estado} size="sm" />
              </div>
              <RailRoute vagon={vagon} />
              {vagon.comentario ? (
                <p className="mt-3 break-words text-xs text-[var(--app-text-muted)]">
                  {vagon.comentario}
                </p>
              ) : null}
              <div className={s.wagonFooter}>
                <span>
                  Inicio: {fmtDate(vagon.fechaInicio)}
                  <br />
                  Fin: {fmtDate(vagon.fechaFin)}
                </span>
                {editable ? (
                  <div className={s.actions}>
                    {onReorderVagon ? (
                      <>
                        <button
                          type="button"
                          className={s.expand}
                          title="Subir vagón"
                          aria-label="Subir vagón"
                          disabled={
                            busyAction !== null || !canMoveWithNeighbor(vagones, index, "up")
                          }
                          onClick={() => onReorderVagon(arrastre, vagon, "up")}
                        >
                          <ArrowUp size={15} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={s.expand}
                          title="Bajar vagón"
                          aria-label="Bajar vagón"
                          disabled={
                            busyAction !== null || !canMoveWithNeighbor(vagones, index, "down")
                          }
                          onClick={() => onReorderVagon(arrastre, vagon, "down")}
                        >
                          <ArrowDown size={15} aria-hidden />
                        </button>
                      </>
                    ) : null}
                    {onEditVagon ? (
                      <button
                        type="button"
                        className={s.expand}
                        disabled={busyAction !== null}
                        onClick={() => onEditVagon(arrastre, vagon)}
                      >
                        <Pencil size={14} aria-hidden />
                        Editar vagón
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
