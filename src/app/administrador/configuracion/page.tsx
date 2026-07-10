import { CatalogosOperativosPageClient } from "@/features/catalogos-operativos";
import { RealtimeHealthPanel } from "@/features/torreon/components/RealtimeHealthPanel";

export default function ConfiguracionOperativaPage() {
  return (
    <div className="space-y-4">
      <RealtimeHealthPanel />
      <CatalogosOperativosPageClient />
    </div>
  );
}
