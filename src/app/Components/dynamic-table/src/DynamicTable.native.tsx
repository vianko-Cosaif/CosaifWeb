import type { DynamicTableProps } from "./types";

export default function DynamicTableNativeFallback<T>(_props: DynamicTableProps<T>) {
  throw new Error(
    "DynamicTable.native fue importado en entorno web. Usa DynamicTable.web o importa desde el index del modulo."
  );
}
