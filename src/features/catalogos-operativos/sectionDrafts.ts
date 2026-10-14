import type { SectionDraft } from "./types";

/** Keep catalog section numbers and names when changing only the section count. */
export function sectionDrafts(count: number, current: SectionDraft[] = []): SectionDraft[] {
  const size = Number.isInteger(count) ? Math.min(200, Math.max(0, count)) : 0;
  const sections = current.slice(0, size);
  let nextNumber = current.reduce((max, section) => Math.max(max, section.numero), 0) + 1;
  while (sections.length < size) {
    const numero = nextNumber++;
    sections.push({ numero, nombre: `Sección ${numero}` });
  }
  return sections;
}
