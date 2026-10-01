import styles from './operation.module.css';

export const daysText = (minutes: number | null) => minutes === null ? 'Sin datos' : minutes > 0 && minutes / 1440 < .01 ? '<0.01 días' : `${(minutes / 1440).toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${minutes === 1440 ? 'día' : 'días'}`;
export const timeText = (minutes: number | null) => minutes === null ? 'Sin datos' : `${minutes.toLocaleString('es-MX', { maximumFractionDigits: 1 })} min · ${daysText(minutes)}`;

export function TimeValue({ minutes }: { minutes: number | null }) {
  if (minutes === null) return <span className={styles.timeValue}>Sin datos<small>Faltan fechas válidas</small></span>;
  return <span className={styles.timeValue}><strong>{daysText(minutes)}</strong><small>{minutes.toLocaleString('es-MX', { maximumFractionDigits: 1 })} min</small></span>;
}
