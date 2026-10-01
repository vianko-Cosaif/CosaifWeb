"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, LoaderCircle, Clock3 } from "lucide-react";
import { authenticate } from "./loginClient";
import styles from "./login.module.scss";

export default function LoginForm() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    // Before hydration a native GET form would put credentials in the URL.
    const url = new URL(window.location.href);
    setSessionExpired(url.searchParams.get("sesion") === "expirada");
    if (url.searchParams.has("username") || url.searchParams.has("password")) {
      url.searchParams.delete("username");
      url.searchParams.delete("password");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    setReady(true);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    setErr("");
    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    if (!username || !password) {
      setErr("Completa tu usuario y contraseña para continuar.");
      return;
    }
    submitting.current = true;
    setSessionExpired(false);
    setLoading(true);
    try {
      const result = await authenticate(username, password, new URLSearchParams(window.location.search).get("next"));
      try { localStorage.setItem("user", JSON.stringify(result.user)); } catch { /* The signed cookie remains the source of authentication. */ }
      window.location.assign(result.destination);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No fue posible iniciar sesión. Inténtalo nuevamente.");
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <form method="post" action="/bff/login" onSubmit={onSubmit} className={styles.form} aria-describedby={err ? "login-error" : sessionExpired ? "login-session-notice" : undefined}>
      {sessionExpired ? <p id="login-session-notice" role="status" className={styles.sessionNotice}><Clock3 size={18} aria-hidden /><span>Tu sesión terminó. Ingresa de nuevo para continuar.</span></p> : null}
      <div className={styles.fields}>
        <div>
          <label htmlFor="username" className={styles.fieldLabel}>Usuario</label>
          <div className={styles.inputWrap}>
            <User className={styles.inputIcon} aria-hidden />
            <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Ingresa tu usuario" required maxLength={128} readOnly={loading} className={styles.input} />
          </div>
        </div>
        <div>
          <label htmlFor="password" className={styles.fieldLabel}>Contraseña</label>
          <div className={styles.inputWrap}>
            <Lock className={styles.inputIcon} aria-hidden />
            <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Ingresa tu contraseña" required maxLength={256} readOnly={loading} className={styles.input} />
            <button type="button" onClick={() => setShow(!show)} className={styles.passwordToggle} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={show}>
              {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>
        </div>
        {err && <p id="login-error" role="alert" className={styles.error}><AlertCircle size={16} aria-hidden /><span>{err}</span></p>}
      </div>
      <button type="submit" disabled={!ready || loading} className={styles.submit} aria-busy={!ready || loading}>
        <span>{!ready ? "Preparando acceso…" : loading ? "Verificando acceso…" : "Ingresar a la plataforma"}</span>
        {loading ? <LoaderCircle size={18} className={styles.spinner} aria-hidden /> : <ArrowRight size={18} aria-hidden />}
      </button>
      <noscript><p className={styles.error}>Activa JavaScript en tu navegador para iniciar sesión.</p></noscript>
    </form>
  );
}
