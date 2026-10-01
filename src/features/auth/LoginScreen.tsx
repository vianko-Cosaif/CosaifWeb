import Image from "next/image";
import { ArrowUpRight, LockKeyhole, Route, ShieldCheck } from "lucide-react";
import LoginForm from "./LoginForm";
import RailwayScene from "./RailwayScene";
import styles from "./login.module.scss";

export default function LoginScreen() {
  return (
    <main id="main" tabIndex={-1} className={styles.page}>
      <section className={styles.story} aria-labelledby="railway-title">
        <div className={styles.storyTop}>
          <span className={styles.platform}>
            <Route size={18} aria-hidden /> OPERACIÓN FERROVIARIA
          </span>
          <span className={styles.brandMark}>COSAIF</span>
        </div>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>
            <span /> COORDINACIÓN EN CADA TRAYECTO
          </p>
          <h2 id="railway-title">
            Tu operación,
            <br />
            en la vía <em>correcta.</em>
          </h2>
          <p className={styles.description}>
            Conecta tus rondas, coordina cada movimiento y mantén el rumbo de tu operación.
          </p>
        </div>
        <div className={styles.sceneWrap}>
          <RailwayScene />
          <div className={styles.sceneCaption}>
            <span className={styles.captionLine} /> PRECISIÓN QUE MUEVE TU OPERACIÓN
          </div>
        </div>
        <ol className={styles.workflow} aria-label="Flujo de la operación">
          <li>
            <span>01</span>
            <div>
              <strong>Planea tus rondas</strong>
              <p>Organiza la jornada.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Coordina movimientos</strong>
              <p>Conecta a tu equipo.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Sigue la operación</strong>
              <p>Da seguimiento al avance.</p>
            </div>
          </li>
        </ol>
      </section>
      <section className={styles.access} aria-labelledby="login-title">
        <header className={styles.accessHeader}>
          <Image
            src="/cosaif-logo.png"
            alt="COSAIF Logistics"
            width={1260}
            height={630}
            priority
            sizes="200px"
            className={styles.logo}
          />
          <span className={styles.accessTag}>
            <ShieldCheck size={14} aria-hidden /> Acceso corporativo
          </span>
        </header>
        <div className={styles.formContent}>
          <div className={styles.formHeading}>
            <span className={styles.welcome}>BIENVENIDO A BORDO</span>
            <h1 id="login-title">Iniciar sesión</h1>
            <p>Todo listo para tu próxima jornada.</p>
          </div>
          <LoginForm />
          <div className={styles.accessNote}>
            <LockKeyhole size={15} aria-hidden />
            <p>Tu acceso corresponde a tu rol y localidad.</p>
          </div>
          <div className={styles.help}>
            <ArrowUpRight size={17} aria-hidden />
            <p>
              <strong>¿Necesitas ayuda para acceder?</strong>
              <span>Contacta al administrador de tu empresa.</span>
            </p>
          </div>
        </div>
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} COSAIF Logistics</span>
          <span>Personal autorizado</span>
        </footer>
      </section>
    </main>
  );
}
