import { TrainFront } from "lucide-react";

export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-white py-10 text-center">
      <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6">
        <TrainFront className="h-12 w-12 text-slate-300" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-slate-500">{text}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
