import Link from "next/link";
import { Home, LogIn } from "lucide-react";
import { Ubuntu } from "next/font/google";
import styles from "./train404.module.scss";

export const dynamic = "force-static";

const ubuntu = Ubuntu({ subsets: ["latin"], weight: ["400", "700"] });

const smokePuffs = ["one", "two", "three", "four", "five", "six"] as const;

function RailWorker({ mode }: { mode: "walking" | "chasing" }) {
  const phaseClass = mode === "walking" ? styles.runnerWalkingPhase : styles.runnerChasingPhase;
  const gaitClass = mode === "walking" ? styles.runnerWalking : styles.runnerChasing;

  return (
    <div className={`${styles.runnerPhase} ${phaseClass}`}>
      <div className={`${styles.runner} ${gaitClass}`}>
        <span className={styles.runnerHead}>
          <span className={styles.runnerFace} />
        </span>
        <span className={styles.runnerBody} />
        <span className={`${styles.runnerArm} ${styles.runnerArmFront}`}>
          <span className={styles.runnerForearm}>
            <span className={styles.runnerHand} />
          </span>
        </span>
        <span className={`${styles.runnerArm} ${styles.runnerArmBack}`}>
          <span className={styles.runnerForearm}>
            <span className={styles.runnerHand} />
          </span>
        </span>
        <span className={`${styles.runnerLeg} ${styles.runnerLegFront}`}>
          <span className={styles.runnerShin}>
            <span className={styles.runnerShoe} />
          </span>
        </span>
        <span className={`${styles.runnerLeg} ${styles.runnerLegBack}`}>
          <span className={styles.runnerShin}>
            <span className={styles.runnerShoe} />
          </span>
        </span>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <main className={`${styles.center} ${ubuntu.className}`}>
      <div className={styles.skyGlow} aria-hidden />
      <div className={styles.stars} aria-hidden />

      <div className={styles.clouds} aria-hidden>
        <span className={`${styles.cloud} ${styles.cloudOne}`} />
        <span className={`${styles.cloud} ${styles.cloudTwo}`} />
        <span className={`${styles.cloud} ${styles.cloudThree}`} />
        <span className={`${styles.cloud} ${styles.cloudFour}`} />
      </div>

      <div className={styles.mountains} aria-hidden>
        <div className={styles.nearRidge} />
      </div>

      <section className={styles.message} aria-labelledby="not-found-title">
        <p className={styles.eyebrow}>COSAIF · Fuera de ruta</p>
        <p className={styles.errorCode} aria-hidden="true">404</p>
        <h1 id="not-found-title">Pagina no encontrada</h1>
        <p className={styles.description}>
          Esta ruta no aparece en el itinerario. Regresa al inicio o inicia sesion para continuar.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={`${styles.action} ${styles.primaryAction}`}>
            <Home aria-hidden size={17} />
            Inicio
          </Link>
          <Link href="/login" className={`${styles.action} ${styles.secondaryAction}`}>
            <LogIn aria-hidden size={17} />
            Iniciar sesion
          </Link>
        </div>
      </section>

      <div className={styles.railScene} aria-hidden="true">
        <div className={styles.bridge} />
        <div className={styles.railBed} />
        <div className={styles.tracks} />

        <div className={styles.train}>
          <div className={styles.dustTrail} />

          <div className={styles.engineFront}>
            <span className={styles.headlight} />
            <span className={`${styles.boilerBand} ${styles.boilerBandOne}`} />
            <span className={`${styles.boilerBand} ${styles.boilerBandTwo}`} />
            <span className={styles.cowcatcher} />
            <div className={styles.chimney}>
              {smokePuffs.map((puff) => (
                <span key={puff} className={`${styles.smoke} ${styles[`smoke${puff[0].toUpperCase()}${puff.slice(1)}`]}`} />
              ))}
            </div>
            <span className={styles.steamDome} />
          </div>

          <div className={styles.engineBody}>
            <span className={styles.cabinWindow} />
            <span className={styles.engineRoof} />
          </div>

          <div className={styles.compartment}>
            <div className={styles.compartmentWindow} />
          </div>
          <div className={`${styles.compartment} ${styles.compartmentTwo}`}>
            <div className={styles.compartmentWindow} />
          </div>
          <div className={`${styles.compartment} ${styles.compartmentThree}`}>
            <div className={styles.compartmentWindow} />
          </div>

          <div className={styles.wheelHolder}>
            <span className={`${styles.wheel} ${styles.wheelOne}`} />
            <span className={`${styles.wheel} ${styles.wheelTwo}`} />
            <span className={`${styles.wheel} ${styles.wheelThree}`} />
            <span className={`${styles.wheel} ${styles.wheelFour}`} />
            <span className={`${styles.wheel} ${styles.wheelFive}`} />
            <span className={`${styles.wheel} ${styles.wheelSix}`} />
            <span className={`${styles.wheel} ${styles.wheelSeven}`} />
            <span className={`${styles.wheel} ${styles.wheelEight}`} />
            <span className={`${styles.wheel} ${styles.wheelNine}`} />
            <span className={styles.driveRod} />
          </div>

        </div>

        <div className={styles.runnerActor}>
          <span className={styles.runnerShadow} />
          <span className={styles.runnerDust} />
          <span className={styles.runnerSurprise}>!</span>
          <RailWorker mode="walking" />
          <RailWorker mode="chasing" />
        </div>
      </div>

      <div className={styles.foreground} aria-hidden />
    </main>
  );
}
