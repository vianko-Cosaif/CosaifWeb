"use client";

import React from "react";
import "./Noticias/Noticias.scss";

const MENSAJE =
  "Estimados clientes se les informa que el dia 1 de diciembre  del presente año  se realizara un mantenimiento programado en el sistema, por lo que el servicio estara interrumpido desde las 01:00 am hasta las 02:30 am. Agradecemos su comprensión y les pedimos disculpas por cualquier inconveniente que esto pueda causar.";

function TrainMini() {
  return (
    // Contenedor que escala el tren gigante a tamaño juguete
    <div className="trainMini-scaleWrapper">
      <div className="trainMini-locomotive">
        
        {/* Chimenea y Humo */}
        <div className="trainMini-chimney">
          <div className="trainMini-smoke s1" />
          <div className="trainMini-smoke s2" />
        </div>

        {/* Cuerpo del Motor */}
        <div className="trainMini-engineBody" />
        
        {/* Frente del Motor */}
        <div className="trainMini-engineFront" />

        {/* Ruedas y Mecanismo */}
        <div className="trainMini-wheelsContainer">
          <div className="trainMini-wheel w1" />
          <div className="trainMini-wheel w2" />
          <div className="trainMini-joint" />
        </div>
      </div>
    </div>
  );
}

export default function Noticias() {
  return (
    <div className="newsBar">
      <div className="newsBar-track">
        {/* TIRA ORIGINAL */}
        <div className="newsBar-strip">
          <TrainMini />
          <div className="newsCar">
            <span className="newsCar-label">INFO</span>
            <span className="newsCar-text">{MENSAJE}</span>
          </div>
        </div>

        {/* TIRA CLON (Para el loop infinito) */}
        <div className="newsBar-strip">
          <TrainMini />
          <div className="newsCar">
            <span className="newsCar-label">INFO</span>
            <span className="newsCar-text">{MENSAJE}</span>
          </div>
        </div>
      </div>
    </div>
  );
}