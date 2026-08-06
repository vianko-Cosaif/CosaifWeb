let toneModulePromise: Promise<typeof import("tone")> | undefined;
let toneModule: typeof import("tone") | undefined;
let activeSoundCleanup: (() => void) | undefined;

type NotificationSoundKind =
  | "incidentAlert"
  | "resolved"
  | "created"
  | "started"
  | "updated"
  | "completed"
  | "paused"
  | "cancelled"
  | "generic";

type SoundStep = {
  at: number;
  notes: string[];
  duration: number;
};

type SoundPattern = { steps: SoundStep[]; disposeAfterMs: number };

const SOUND_PATTERNS: Record<NotificationSoundKind, SoundPattern> = {
  // Incidente nuevo/abierto: acorde disminuido grave, lento y disonante.
  incidentAlert: {
    steps: [
      { at: 0, notes: ["G2", "C#3"], duration: 0.72 },
      { at: 0.58, notes: ["F#2", "C3"], duration: 0.68 },
      { at: 1.18, notes: ["Ab2", "D3"], duration: 0.72 },
      { at: 1.82, notes: ["C#4", "G4"], duration: 0.3 },
      { at: 2.18, notes: ["G2", "C#3", "Ab3"], duration: 0.95 },
    ],
    disposeAfterMs: 4_000,
  },
  // Todas las confirmaciones son breves y tonales para no confundirse con una alarma.
  resolved: {
    steps: [
      { at: 0, notes: ["C5"], duration: 0.28 },
      { at: 0.36, notes: ["D5"], duration: 0.28 },
      { at: 0.74, notes: ["G5"], duration: 0.34 },
      { at: 1.18, notes: ["C6", "G5"], duration: 0.36 },
    ],
    disposeAfterMs: 1_900,
  },
  created: {
    steps: [
      { at: 0, notes: ["C5"], duration: 0.28 },
      { at: 0.38, notes: ["G5"], duration: 0.3 },
      { at: 0.8, notes: ["C6"], duration: 0.38 },
    ],
    disposeAfterMs: 1_600,
  },
  started: {
    // "tan - tin - tan - tan", cadencia ascendente en Sol mayor.
    steps: [
      { at: 0, notes: ["G4"], duration: 0.22 },
      { at: 0.27, notes: ["B4"], duration: 0.18 },
      { at: 0.52, notes: ["D5"], duration: 0.24 },
      { at: 0.82, notes: ["G5", "D5"], duration: 0.42 },
    ],
    disposeAfterMs: 1_650,
  },
  updated: {
    steps: [
      { at: 0, notes: ["D5", "G5"], duration: 0.28 },
      { at: 0.48, notes: ["D5"], duration: 0.26 },
      { at: 0.86, notes: ["G5"], duration: 0.36 },
    ],
    disposeAfterMs: 1_600,
  },
  completed: {
    // "tin - tom - tin - tam", cierre descendente en Sol mayor.
    steps: [
      { at: 0, notes: ["D5"], duration: 0.2 },
      { at: 0.3, notes: ["G4"], duration: 0.3 },
      { at: 0.65, notes: ["B4"], duration: 0.2 },
      { at: 0.95, notes: ["G4", "D5"], duration: 0.48 },
    ],
    disposeAfterMs: 1_750,
  },
  paused: {
    steps: [
      { at: 0, notes: ["G4"], duration: 0.3 },
      { at: 0.48, notes: ["D5"], duration: 0.28 },
      { at: 0.88, notes: ["G4"], duration: 0.34 },
    ],
    disposeAfterMs: 1_600,
  },
  cancelled: {
    steps: [
      { at: 0, notes: ["D5"], duration: 0.3 },
      { at: 0.42, notes: ["C5"], duration: 0.3 },
      { at: 0.84, notes: ["D4"], duration: 0.36 },
    ],
    disposeAfterMs: 1_600,
  },
  generic: {
    steps: [
      { at: 0, notes: ["C5", "G5"], duration: 0.32 },
      { at: 0.52, notes: ["D5", "G5"], duration: 0.32 },
      { at: 0.98, notes: ["C5", "G5"], duration: 0.36 },
    ],
    disposeAfterMs: 1_700,
  },
};

function soundKind(value: string): NotificationSoundKind {
  const normalized = value.toLowerCase();
  const isIncident = normalized.includes("incident");
  if (isIncident && /(resuelt|cerrad|continuad|omitid)/.test(normalized)) return "resolved";
  if (isIncident) return "incidentAlert";
  if (/(concluid|finaliz|completad)/.test(normalized)) return "completed";
  if (/(cancelad|eliminad)/.test(normalized)) return "cancelled";
  if (/(detenid|pausad|bloquead)/.test(normalized)) return "paused";
  if (/(inici|reanud|en_proceso)/.test(normalized)) return "started";
  if (/(cread|nuevo|solicitad|reportad)/.test(normalized)) return "created";
  if (/(editad|actualiz|cambio|priori|orden)/.test(normalized)) return "updated";
  return "generic";
}

function loadTone() {
  toneModulePromise ??= import("tone").then((module) => {
    toneModule = module;
    return module;
  });
  return toneModulePromise;
}

export function preloadNotificationSound() {
  void loadTone().catch((error) => {
    console.warn("No se pudo precargar el audio de notificaciones.", error);
  });
}

/**
 * Desbloquea el contexto de audio durante una accion directa del usuario.
 * Los navegadores no permiten iniciar audio automatico antes de esa accion.
 */
export function primeNotificationSound(): Promise<boolean> {
  // Tone.start debe ejecutarse de forma sincrona dentro del gesto del usuario.
  // Si el modulo aun no termina de cargar, conservamos el listener para el siguiente gesto.
  if (!toneModule) {
    preloadNotificationSound();
    return Promise.resolve(false);
  }

  if (toneModule.getContext().state === "running") return Promise.resolve(true);
  return toneModule.start()
    .then(() => toneModule?.getContext().state === "running")
    .catch(() => false);
}

export async function playNotificationSound(notificationType = "generic") {
  try {
    const Tone = await loadTone();
    if (Tone.getContext().state !== "running") {
      const ready = await Tone.start()
        .then(() => Tone.getContext().state === "running")
        .catch(() => false);
      if (!ready) {
        console.warn("Audio de notificaciones bloqueado hasta la siguiente interaccion.");
        return;
      }
    }

    activeSoundCleanup?.();

    const kind = soundKind(notificationType);
    const isIncidentAlert = kind === "incidentAlert";
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: isIncidentAlert ? "sawtooth" : "triangle" },
      envelope: isIncidentAlert
        ? { attack: 0.08, decay: 0.28, sustain: 0.26, release: 1.15 }
        : { attack: 0.005, decay: 0.12, sustain: 0.12, release: 0.5 },
    });
    const effects: Array<{ dispose: () => void }> = [];

    if (isIncidentAlert) {
      const lowPass = new Tone.Filter(920, "lowpass").toDestination();
      lowPass.Q.value = 4.5;
      const echo = new Tone.FeedbackDelay(0.22, 0.32).connect(lowPass);
      echo.wet.value = 0.28;
      synth.connect(echo);
      effects.push(echo, lowPass);
    } else {
      synth.toDestination();
    }

    synth.volume.value = isIncidentAlert ? -19 : -11;
    const now = Tone.now();
    const pattern = SOUND_PATTERNS[kind];
    pattern.steps.forEach((step) => {
      synth.triggerAttackRelease(step.notes, step.duration, now + step.at);
    });

    let disposed = false;
    let timeoutId = 0;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      window.clearTimeout(timeoutId);
      synth.releaseAll();
      synth.dispose();
      effects.forEach((effect) => effect.dispose());
    };
    timeoutId = window.setTimeout(() => {
      cleanup();
      if (activeSoundCleanup === cleanup) activeSoundCleanup = undefined;
    }, pattern.disposeAfterMs);
    activeSoundCleanup = cleanup;
  } catch (error) {
    console.warn("No se pudo reproducir el sonido de notificacion.", error);
  }
}
