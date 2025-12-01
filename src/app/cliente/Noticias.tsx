"use client";

import React from "react";
import "./Noticias/Noticias.scss";

const MENSAJE =
  "Se acerca navidad, Vianko te desea prosperidad y felicidad a tu hogar. ¡Felices fiestas! 🎄​🎄​​🎅🏼​🤶🏻​ ";

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