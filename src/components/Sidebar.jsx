import React from 'react';
import { NavLink } from 'react-router-dom'; 
import './Sidebar.css';

export default function Sidebar({ isCollapsed, onLogout }) {
  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-menu">
        {!isCollapsed && <p className="menu-title">Main Menu</p>}
        
        <NavLink 
          to="/Dashboard" 
          className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
        >
          <span className="material-symbols-outlined">dashboard</span>
          {!isCollapsed && <span className="nav-text">Dashboard</span>}
        </NavLink>

        <NavLink 
          to="/Tickets" 
          className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
        >
          <span className="material-symbols-outlined">confirmation_number</span>
          {!isCollapsed && <span className="nav-text">Tickets</span>}
        </NavLink>

        <NavLink 
          to="/Archivados" 
          className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
        >
          <span className="material-symbols-outlined">inventory_2</span>
          {!isCollapsed && <span className="nav-text">Archivados</span>}
        </NavLink>

        <NavLink 
          to="/Usuarios" 
          className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
        >
          <span className="material-symbols-outlined">group</span>
          {!isCollapsed && <span className="nav-text">Usuarios</span>}
        </NavLink>

        <NavLink 
          to="/Reportes" 
          className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
        >
          <span className="material-symbols-outlined">analytics</span>
          {!isCollapsed && <span className="nav-text">Reportes</span>}
        </NavLink>
      </div>

      <div className="sidebar-bottom">
        <button 
          onClick={onLogout} 
          className="nav-item" 
          style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
        >
          <span className="material-symbols-outlined">logout</span>
          {!isCollapsed && <span className="nav-text">Salir</span>}
        </button>
      </div>
    </aside>
  );
}