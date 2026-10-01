import StatusBadge from "@/components/ui/StatusBadge";

export default function TornoStatusBadge({ status, compact = false }: { status?: string; compact?: boolean }) {
  const key = String(status || "").toUpperCase();
  return (
    <StatusBadge
      status={status}
      label={key === "TERMINADO" ? "Terminado" : key === "PAUSADO" ? "Pausado" : undefined}
      tone={key === "TERMINADO" ? "success" : key === "PAUSADO" ? "warning" : undefined}
      size={compact ? "sm" : "md"}
      dot
    />
  );
}
