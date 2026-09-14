"use client";
import { useState } from 'react';
import { ArrowRight, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { Metrics, OperationReport, Explore } from './types';
import styles from './operation.module.css';
import { TimeValue, daysText } from './TimeValue';

const n = (v: number | null, decimals = 1) => v === null ? 'Sin datos' : v.toLocaleString('es-MX', { maximumFractionDigits: decimals });
const min = (v: number | null) => v === null ? 'Sin datos' : `${n(v)} min`;
const pct = (v: number | null) => v === null ? 'Sin datos' : `${n(v)}%`;
export const bandLabels = { short: 'Menos de 10 min · Revisar', acceptable: '10 a 30 min · Aceptable', long: 'Más de 30 min · Atención', unassessed: 'Fechas por completar' };

export function DurationBands({ metrics: m, explore }: { metrics: Metrics; explore: Explore }) {
  const bands = [
    { filter: 'short', count: m.durationShort, label: 'Menos de 10 minutos', decision: 'Revisar', note: 'Verificar la duración con la bitácora.', icon: <Info size={19} /> },
    { filter: 'acceptable', count: m.durationAcceptable, label: 'De 10 a 30 minutos', decision: 'Aceptable', note: 'Incluye 10 y 30. Estar en rango no significa haber concluido.', icon: <CheckCircle2 size={19} /> },
    { filter: 'long', count: m.durationLong, label: 'Más de 30 minutos', decision: 'Atención', note: 'Revisar pausas, incidentes y recorrido.', icon: <TriangleAlert size={19} /> },
  ];
  return <section className={styles.card}>
    <div className={styles.bandHeading}><div><h2>¿Cuántos movimientos duran lo aceptable?</h2><p className={styles.note}>Inicio → conclusión, detención o cancelación. Los tres estados cuentan si tienen fechas válidas.</p></div><div><strong>{pct(m.acceptableRate)}</strong><span>aceptable · {n(m.durationAcceptable, 0)} de {n(m.executionN, 0)} evaluados</span></div></div>
    <div className={styles.bandGrid}>{bands.map(b => <button type="button" key={b.filter} data-band={b.filter} onClick={() => explore(b.filter)}>
      <span>{b.icon}{b.decision}</span><strong>{n(b.count, 0)}</strong><b>{b.label}</b><small>{`${pct(m.executionN ? b.count / m.executionN * 100 : null)} de los evaluados`}</small><p>{b.note}</p><span className={styles.bandLink}>Ver movimientos <ArrowRight size={15} /></span>
    </button>)}</div>
    <p className={styles.note}>{n(m.executionN, 0)} intervalos calculados. Todos los movimientos conservan su estado: {n(m.concluded, 0)} concluidos, {n(m.stopped, 0)} detenidos y {n(m.cancelled, 0)} cancelados. {m.durationOpen > 0 && `${n(m.durationOpen, 0)} abiertos todavía sin corte. `}{m.durationMissing > 0 && <button type="button" className={styles.textButton} onClick={() => explore('duration_data')}>Revisar fechas de {n(m.durationMissing, 0)} registros cerrados</button>}</p>
  </section>;
}

export function CompanyClients({ r, explore }: { r: OperationReport; explore: Explore }) {
  const [company, setCompany] = useState(''), [search, setSearch] = useState('');
  const [view, setView] = useState<'delay' | 'duration'>('delay');
  const [order, setOrder] = useState('incidentMinutes'), [page, setPage] = useState(1);
  const filtered = r.clients.filter(c => (!company || String(c.companyId) === company) && c.label.toLocaleLowerCase('es-MX').includes(search.toLocaleLowerCase('es-MX'))).sort((a, b) => {
    const key = order as 'total' | 'affected' | 'excessMinutes' | 'clientDelayMinutes' | 'incidentMinutes';
    return b[key] - a[key] || a.label.localeCompare(b.label);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const rows = filtered.slice((page - 1) * 10, page * 10);
  return <section className={styles.card}>
    <h2>Retrasos e incidentes por cliente</h2>
    <p className={styles.note}>Cada cliente conserva la empresa de sus solicitudes. Abre una cifra para ver los movimientos que la explican.</p>
    <div className={styles.subnav} aria-label="Vista del desglose por cliente">
      <button type="button" aria-pressed={view === 'delay'} onClick={() => setView('delay')}>Retrasos en días y minutos</button>
      <button type="button" aria-pressed={view === 'duration'} onClick={() => setView('duration')}>Duración y atención</button>
    </div>
    <div className={styles.tableTools}>
      <label>Desglosar empresa<select value={company} onChange={e => { setCompany(e.target.value); setPage(1); }}><option value="">Todas las empresas</option>{r.companies.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
      <label>Buscar cliente<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Nombre del cliente" /></label>
      <label>Orden del desglose<select value={order} onChange={e => { setOrder(e.target.value); setPage(1); }}><option value="incidentMinutes">Más tiempo con incidentes</option><option value="clientDelayMinutes">Mayor retraso del cliente</option><option value="total">Más movimientos</option><option value="affected">Más movimientos con incidentes</option><option value="excessMinutes">Más minutos sobre 30</option></select></label>
    </div>
    {view === 'delay' && <div className={styles.readingKey}>
      <p><b>Tiempo con incidentes:</b> tiempo del movimiento que coincide con incidentes registrados.</p>
      <p><b>Retraso del cliente:</b> desde el inicio hasta la detención o cancelación, según el criterio administrativo.</p>
      <p><b>1 día = 1,440 minutos.</b> Son días acumulados de 24 horas. Ambas lecturas pueden coincidir y no se suman.</p>
    </div>}
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Desglose de empresas y clientes">
      <table className={styles.clientTable}><thead><tr>
        <th>Cliente / empresa</th><th>Solicitudes</th>
        {view === 'delay' ? <><th>Con incidentes</th><th>Tiempo con incidentes<small>Días y minutos calculados</small></th><th>Retraso del cliente<small>Días y minutos calculados</small></th><th>Fechas pendientes</th></> : <><th>Menos de 10<small>Revisar</small></th><th>10 a 30<small>Aceptable</small></th><th>Más de 30<small>Atención</small></th><th>Espera promedio</th><th>Exceso sobre 30</th></>}
      </tr></thead><tbody>{rows.map(c => {
        const drill = (filter: string) => explore(filter, '', '', '', { group: 'client', groupKey: c.key, label: c.label });
        const delay = !c.clientDelayN && c.clientDelayMissing ? null : c.clientDelayMinutes;
        const incidents = !c.incidentTimeN && c.incidentTimeMissing ? null : c.incidentMinutes;
        return <tr key={c.key}>
          <th scope="row">{c.client}<small>{c.company}</small></th>
          <td><button type="button" className={styles.textButton} onClick={() => drill('all')} aria-label={`Ver todos: ${c.label}`}>{n(c.total, 0)}</button><small>{n(c.stopped, 0)} detenidos<br />{n(c.cancelled, 0)} cancelados</small></td>
          {view === 'delay' ? <>
            <td><button type="button" className={styles.textButton} onClick={() => drill('incident')} aria-label={`Ver incidentes: ${c.label}`}>{n(c.affected, 0)} movimientos</button><small>{pct(c.incidentRate)} de sus solicitudes</small></td>
            <td><button type="button" className={styles.textButton} onClick={() => drill('incident')} aria-label={`Ver tiempo con incidentes: ${c.label}`}><TimeValue minutes={incidents} /></button>{c.incidentTimeMissing > 0 && incidents !== null && <small>Total parcial</small>}</td>
            <td><button type="button" className={styles.textButton} onClick={() => drill(delay === null ? 'client_delay_missing' : 'client_delay')} aria-label={`Ver retraso del cliente: ${c.label}`}><TimeValue minutes={delay} /></button><small>{n(c.clientDelayN, 0)} intentos con tiempo{c.clientDelayMissing > 0 && delay !== null ? ' · parcial' : ''}</small></td>
            <td>{c.clientDelayMissing > 0 ? <button type="button" className={styles.textButton} onClick={() => drill('client_delay_missing')}>{n(c.clientDelayMissing, 0)} de retraso</button> : <span>Retraso completo</span>}<small>{c.incidentTimeMissing > 0 ? `${n(c.incidentTimeMissing, 0)} ${c.incidentTimeMissing === 1 ? 'movimiento con fechas de incidentes pendientes' : 'movimientos con fechas de incidentes pendientes'}` : 'Incidentes completos'}</small></td>
          </> : <>
            {(['short', 'acceptable', 'long'] as const).map((band, i) => <td key={band}><button type="button" data-band={band} className={styles.bandCount} onClick={() => drill(band)} aria-label={`${bandLabels[band]}: ${c.label}`}>{n([c.durationShort, c.durationAcceptable, c.durationLong][i], 0)}</button>{band === 'acceptable' && <small>{pct(c.acceptableRate)}</small>}</td>)}
            <td>{min(c.waitAverage)}</td><td>{min(c.excessMinutes)}</td>
          </>}
        </tr>;
      })}</tbody></table>
    </div>
    {!filtered.length && <p className={styles.note}>No hay clientes con esta selección.</p>}
    <div className={styles.pager}><span>{filtered.length} grupos · Página {page} de {pages}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
    <p className={styles.note}>{view === 'delay' ? 'Los incidentes simultáneos se cuentan una vez por movimiento. Coincidir con un incidente no demuestra que todo ese tiempo haya sido causado por él. Los días representan tiempo acumulado de movimientos, no días completos de paro del patio.' : 'Las bandas incluyen concluidos, detenidos y cancelados con fechas válidas. El porcentaje aceptable usa los intentos evaluados. La espera anterior al inicio se muestra aparte.'}</p>
  </section>;
}

export function IncidentResolution({ r, explore }: { r: OperationReport; explore: Explore }) {
  const i = r.incidents;
  const [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const reporters = i.reporters.filter(v => v.label.toLocaleLowerCase('es-MX').includes(search.toLocaleLowerCase('es-MX')));
  const pages = Math.max(1, Math.ceil(reporters.length / 10));
  return <><section className={styles.card}><h2>¿Se resolvieron o solamente se cerraron?</h2><p className={styles.note}>El sistema puede cerrar incidentes automáticamente. Por eso CERRADO y RESUELTO se muestran separados.</p><div className={styles.resolutionGrid}>{[
    ['Resueltos', n(i.resolved, 0), 'Estado RESUELTO'], ['Cerrados', n(i.closed, 0), 'Puede incluir cierre automático sin resolución'], ['Abiertos', n(i.open, 0), i.open ? `El más antiguo lleva ${min(i.oldestOpen)}` : 'Ninguno abierto en esta consulta'],
    ['Resolución promedio', min(i.resolutionAverage), `${i.resolutionN} resoluciones con duración válida`], ['Resolución habitual', min(i.resolutionMedian), 'Mediana: la mitad tardó esto o menos'], ['Resolución para 9 de 10', min(i.resolutionP90), `${i.resolutionMissing} resueltos sin intervalo válido`],
  ].map(([label, value, note]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div></section>
  <section className={styles.card}><h2>Usuarios con más incidentes registrados</h2><p className={styles.note}>Ordenado por cantidad de incidentes. Este usuario es el informante guardado en el incidente, no necesariamente quien lo causó o resolvió. Las asignaciones a clientes y operadores se consultan en Empresas, clientes y vías.</p><label className={styles.search}>Buscar informante<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><div className={styles.tableScroll}><table><thead><tr><th>Informante</th><th>Incidentes</th><th>Movimientos distintos</th><th>Abiertos</th><th>Resueltos</th><th>Cerrados</th><th>Resolución promedio</th><th>Detalle</th></tr></thead><tbody>{reporters.slice((page - 1) * 10, page * 10).map(v => <tr key={v.key}><th scope="row">{v.label}</th><td>{v.total}</td><td>{v.movements}</td><td>{v.open}</td><td>{v.resolved}</td><td>{v.closed}</td><td>{min(v.resolutionAverage)}<small>{v.resolutionN} intervalos válidos</small></td><td><button type="button" className={styles.textButton} onClick={() => explore('incident', '', '', '', { group: 'reporter', groupKey: v.key, label: `Informante: ${v.label}` })}>Ver movimientos</button></td></tr>)}</tbody></table></div><div className={styles.pager}><span>{reporters.length} informantes · Página {page} de {pages}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</button></div></div></section></>;
}

export function ClientDelaySummary({ r, explore }: { r: OperationReport; explore: Explore }) {
  const k = r.summary;
  return <section className={styles.card}><h2>Retraso del cliente</h2><p className={styles.note}>En detenidos y cancelados: inicio → detención o cancelación. Es el criterio administrativo aplicado al cliente asociado al movimiento.</p><div className={styles.resolutionGrid}><div><span>Tiempo atribuido al cliente</span><strong>{daysText(!k.clientDelayN && k.clientDelayMissing ? null : k.clientDelayMinutes)}</strong><span>{!k.clientDelayN && k.clientDelayMissing ? 'Faltan fechas válidas' : `${min(k.clientDelayMinutes)} · días de 24 horas`}</span><small>{n(k.clientDelayN, 0)} intentos con fechas válidas</small></div><div><span>Detenidos / cancelados</span><strong>{n(k.stopped, 0)} / {n(k.cancelled, 0)}</strong><small>El estado sigue visible aunque su duración esté en 10 a 30</small></div><div><span>Faltan fechas para calcular</span><strong>{n(k.clientDelayMissing, 0)}</strong><small>No se sustituyen por cero minutos</small></div></div><div className={styles.tableTools}><button type="button" className={styles.textButton} onClick={() => explore('client_delay')}>Ver retrasos y fechas <ArrowRight size={15} /></button><button type="button" className={styles.textButton} onClick={() => explore('client_delay_missing')}>Revisar fechas faltantes <ArrowRight size={15} /></button></div><p className={styles.note}>La espera anterior al inicio se muestra aparte. Un detenido puede volver a la cola como otro intento; el tiempo del intento anterior se conserva. Si no hay fecha de fin, la fecha de pausa marca el corte del detenido.</p></section>;
}

export function RetryHistory({ r, explore }: { r: OperationReport; explore: Explore }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(r.retries.length / 10));
  return <section className={styles.card}><h2>Reintentos: tiempo que también cuenta</h2><p className={styles.note}>Enlaces explícitos entre movimientos reprogramados. Se suma cada intento visible una vez. El historial puede ser parcial por el periodo o los filtros; cada fila muestra su último estado visible.</p><div className={styles.tableScroll}><table><thead><tr><th>Empresa / cliente</th><th>Movimientos de la cadena</th><th>Resultado visible</th><th>Retraso del cliente</th><th>Espera acumulada</th><th>Incidentes</th><th>Detalle</th></tr></thead><tbody>{r.retries.slice((page - 1) * 10, page * 10).map(c => <tr key={c.key}><th scope="row">{c.company}<small>{c.client} · Locomotora {c.locomotive}</small></th><td>{c.ids.map(id => '#' + id).join(' → ')}<small>{c.attempts} intentos visibles{c.continuesOutside ? ' · continuación fuera de esta selección' : ''}</small></td><td>{c.state}<small>{c.cancelledByIncidentLimit ? 'Cancelación registrada por límite de 3 o más incidentes' : ''}</small></td><td>{min(c.clientDelayMinutes)}<small>{c.clientDelayMissing} intentos sin fechas</small></td><td>{min(c.waitMinutes)}</td><td>{c.incidents}</td><td><button type="button" className={styles.textButton} onClick={() => explore('all', '', '', '', { group: 'retry', groupKey: c.key, label: 'Reintentos ' + c.ids.map(id => '#' + id).join(' → ') })}>Ver intentos</button></td></tr>)}</tbody></table></div>{!r.retries.length && <p>No hay enlaces de reprogramación ni cancelaciones por límite identificadas en esta selección.</p>}<div className={styles.pager}><span>{r.retries.length} cadenas / referencias · Página {page} de {pages}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</button></div></div></section>;
}

export function ImpactSummary({ r }: { r: OperationReport }) {
  return <section className={styles.card}><h2>Otros tiempos para explicar la operación</h2><div className={styles.twoColumns}><div className={styles.timeBlock}><h3>Exceso sobre 30 minutos</h3><strong>{min(r.summary.excessMinutes)}</strong><p>Solo la parte que supera 30 minutos en {n(r.summary.durationLong, 0)} intentos concluidos, detenidos o cancelados.</p></div><div className={styles.timeBlock}><h3>Tiempo coincidente con incidentes</h3><strong>{daysText(!r.summary.incidentTimeN && r.summary.incidentTimeMissing ? null : r.summary.incidentMinutes)}</strong><b>{!r.summary.incidentTimeN && r.summary.incidentTimeMissing ? 'Faltan fechas válidas' : `${min(r.summary.incidentMinutes)} · días de 24 horas`}</b>{r.summary.incidentTimeMissing > 0 && <small>Total parcial: {n(r.summary.incidentTimeMissing, 0)} movimientos con fechas pendientes</small>}<p>Intervalos observados de movimientos, incluidos abiertos hasta la consulta. Los incidentes simultáneos se cuentan una vez por movimiento.</p></div></div><p className={styles.note}>Estas lecturas pueden coincidir entre sí y con el retraso del cliente: no se suman. La coincidencia con un incidente no identifica a su causante.</p></section>;
}
