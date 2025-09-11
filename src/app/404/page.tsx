// app/404/page.tsx
import React from "react";
import styles from "./train404.module.scss";
import Link from "next/link";
import { Ubuntu } from "next/font/google";

export const dynamic = "force-static";

const ubuntu = Ubuntu({ subsets: ["latin"], weight: ["400", "700"] });

export default function NotFound() {
  return (
    <main
      className={`${styles.center} ${ubuntu.className}`}
      style={{
        position: "relative",
        height: "100svh",
        overflow: "clip", // sin scroll
      }}
    >
      {/* Fondo: brillo cálido bajo y gradientes */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background:
            "radial-gradient(80rem 40rem at 50% 120%, rgba(255,115,0,0.15), transparent 60%), radial-gradient(60rem 30rem at 15% -10%, rgba(255,210,120,0.20), transparent 60%)",
          animation: "heatwave 8s ease-in-out infinite",
        }}
      />

      {/* Nubes sutiles en la parte alta */}
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const top = 5 + Math.random() * 90; // 5–30%
          const left = Math.random() * 1000;
          const w = 120 + Math.random() * 2400; // ancho
          const h = 30 + Math.random() * 800; // alto
          const dur = 14 + Math.random() * 89; // duración
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                top: `${top}%`,
                left: `${left}%`,
                width: `${w}px`,
                height: `${h}px`,
                borderRadius: "999px",
                background: "linear-gradient(to right, rgba(255,255,255,.55), rgba(255,255,255,.25))",
                filter: "blur(1px)",
      
                animation: `drift ${dur}s ease-in-out ${i * 3}s infinite alternate`,
              }}
            />
          );
        })}
      </div>

      {/* Montañas y marco */}
      <div className={styles.mountains} />
      <div className={styles.frame}>
        {/* Vías bajo el tren (si no tienes .tracks en SCSS, ignóralo) */}
       

        {/* Tren */}
        <div className={styles.train}>
          <div className={styles["engine-front"]}>
            <div className={styles.chimney}>
              <div className={styles.smoke} />
              <div className={`${styles.smoke} ${styles["smoke-2"]}`} />
              <div className={`${styles.smoke} ${styles["smoke-3"]}`} />
              <div className={`${styles.smoke} ${styles["smoke-4"]}`} />
            </div>
          </div>

          <div className={styles["engine-body"]} />

          <div className={styles.compartment}>
            <div className={styles["compartment-window"]} />
          </div>

          <div className={`${styles.compartment} ${styles["compartment-two"]}`}>
            <div className={styles["compartment-window"]} />
          </div>

          <div className={`${styles.compartment} ${styles["compartment-three"]}`}>
            <div className={styles["compartment-window"]} />
          </div>

          <div className={styles["wheel-holder"]}>
            <div className={styles.wheel} />
            <div className={`${styles.wheel} ${styles["wheel-2"]}`}>
              <div className={styles["wheel-joint"]} />
              <div className={`${styles["wheel-joint"]} ${styles["wheel-joint-2"]}`} />
            </div>
            <div className={`${styles.wheel} ${styles["wheel-3"]}`} />
            <div className={`${styles.wheel} ${styles["wheel-4"]}`} />
            <div className={`${styles.wheel} ${styles["wheel-5"]}`} />
            <div className={`${styles.wheel} ${styles["wheel-6"]}`} />
            <div className={`${styles.wheel} ${styles["wheel-7"]}`} />
            <div className={`${styles.wheel} ${styles["wheel-8"]}`} />
            <div className={`${styles.wheel} ${styles["wheel-9"]}`} />
          </div>
        </div>
      </div>

      <div className={styles.bridge} />

      {/* CTA abajo del tren */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "15.5rem", // debajo del tren (tren bottom: 12.6rem, puente: 10rem)
          zIndex: 2, // visible pero sin tapar elementos con z>2 si los hubiera
          display: "grid",
          placeItems: "center",
          padding: "0 1rem",
          textAlign: "center",
          color: "#ffffffff",
          textShadow: "0 2px 10px rgba(159, 26, 26, 1)",
        }}
      >
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "0.02em" }}>
          Página no encontrada
        </h1>
        <p style={{ opacity: 0.9, marginTop: ".4rem" }}>
          Upps, por el momento nos encontramos trabajando en el problema
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: ".6rem", justifyContent: "center" }}>
          <Link
            href="/"
            style={{
              background: "#be0505ff",
              color: "#111827",
              padding: ".6rem 1rem",
              borderRadius: ".8rem",
              fontWeight: 700,
            }}
          >
            Inicio
          </Link>
          <Link
            href="/login"
            style={{
              background: "#111827",
              color: "#ffffff",
              padding: ".6rem 1rem",
              borderRadius: ".8rem",
              fontWeight: 700,
            }}
          >
            Login
          </Link>
        </div>
      </div>

    </main>
  );
}
