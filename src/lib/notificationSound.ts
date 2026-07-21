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
  // Único aviso largo: incidente nuevo/abierto.
  incidentAlert: {
    steps: [0, 0.55, 1.1, 1.65, 2.2, 2.75].map((at, index) => ({
      at,
      notes: index % 2 === 0 ? ["G5", "D6"] : ["D5", "G5"],
      duration: 0.24,
    })),
    disposeAfterMs: 3_500,
  },
  // Todas las confirmaciones duran menos de dos segundos y usan Do, Re y Sol.
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
    steps: [
      { at: 0, notes: ["C5"], duration: 0.28 },
      { at: 0.34, notes: ["D5"], duration: 0.28 },
      { at: 0.7, notes: ["G5"], duration: 0.4 },
    ],
    disposeAfterMs: 1_600,
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
    steps: [
      { at: 0, notes: ["G5"], duration: 0.3 },
      { at: 0.42, notes: ["D5"], duration: 0.3 },
      { at: 0.84, notes: ["C5"], duration: 0.34 },
      { at: 1.25, notes: ["C5", "G5"], duration: 0.34 },
    ],
    disposeAfterMs: 1_900,
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

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.005,
        decay: 0.12,
        sustain: 0.12,
        release: 0.5,
      },
    }).toDestination();

    synth.volume.value = -12;
    const now = Tone.now();
    const pattern = SOUND_PATTERNS[soundKind(notificationType)];
    pattern.steps.forEach((step) => {
      synth.triggerAttackRelease(step.notes, step.duration, now + step.at);
    });

    const timeoutId = window.setTimeout(() => {
      synth.dispose();
      if (activeSoundCleanup === cleanup) activeSoundCleanup = undefined;
    }, pattern.disposeAfterMs);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      synth.releaseAll();
      synth.dispose();
    };
    activeSoundCleanup = cleanup;
  } catch (error) {
    console.warn("No se pudo reproducir el sonido de notificacion.", error);
  }
}
