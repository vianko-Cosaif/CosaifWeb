import { ConfigurationSectionNav } from "../../../features/configuracion/ConfigurationSectionNav";

export default function ConfigurationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <ConfigurationSectionNav />
      {children}
    </div>
  );
}
