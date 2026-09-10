import StatusBadge from "@/components/ui/StatusBadge";
import { statusText } from "../utils";

export function EstadoBadge({ estado }: { estado?: string | null }) {
  return <StatusBadge status={statusText(estado)} className="min-w-[92px] justify-center" />;
}
