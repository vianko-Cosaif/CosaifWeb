import { TrainFront } from "lucide-react";
import DataEmptyState from "@/components/ui/DataEmptyState";

export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return <DataEmptyState title={text} description={hint} icon={TrainFront} />;
}
