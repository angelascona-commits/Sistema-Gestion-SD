import React from 'react';
import './Header.css';

export default function Header({ toggleSidebar, usuario }) {
  
  const obtenerIniciales = (nombre) => {
    if (!nombre) return 'US';
    return nombre.substring(0, 2).toUpperCase();
  };

  const nombreMostrar = usuario?.nombre || 'Cargando...';
  const rolMostrar = usuario?.rol || 'Agente';
  const iniciales = obtenerIniciales(nombreMostrar);

  return (
    <header className="top-header">
      <div className="header-left">
        <button className="menu-toggle" onClick={toggleSidebar}>
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="logo-container">
          <h2 className="logo-text">Service Desk</h2>
        </div>

        <div className="search-box">
          <span className="material-symbols-outlined search-icon">search</span>
          <input type="text" placeholder="Buscar tickets, usuarios o módulos..." />
        </div>
      </div>

      <div className="header-right">
        <div className="divider"></div>
        
        <div className="user-profile">
          <div className="user-info">
            <p className="user-name">{nombreMostrar}</p>
            <p className="user-role">{rolMostrar.toUpperCase()}</p>
          </div>
          <div className="avatar">{iniciales}</div>
        </div>
      </div>
    </header>
  );
}