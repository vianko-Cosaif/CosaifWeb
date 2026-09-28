import type { ReactNode } from "react";
import { Boxes, TrainFront } from "lucide-react";
import s from "../presentation/rail.module.scss";

type Mode = "naturales" | "arrastres";

const MODES = {
  naturales: {
    icon: TrainFront,
    eyebrow: "Torreón · Naturales",
  },
  arrastres: {
    icon: Boxes,
    eyebrow: "Torreón · Arrastres",
  },
} as const;

export function TorreonModeIntro({
  mode,
  title,
  actions,
  heading = "h2",
}: {
  mode: Mode;
  title: string;
  actions?: ReactNode;
  heading?: "h1" | "h2";
}) {
  const { icon: Icon, eyebrow } = MODES[mode];
  const Heading = heading;

  return (
    <header className={s.modeIntro} data-mode={mode}>
      <div className={s.modeIntroMain}>
        <span className={s.modeIntroIcon} aria-hidden="true">
          <Icon size={24} strokeWidth={1.8} />
        </span>
        <div className={s.modeIntroCopy}>
          <p className={s.modeIntroEyebrow}>{eyebrow}</p>
          <Heading className={s.modeIntroTitle}>{title}</Heading>
        </div>
      </div>
      {actions ? <div className={s.modeIntroActions}>{actions}</div> : null}
    </header>
  );
}
