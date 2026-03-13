import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import './Layout.css';

export default function Layout({ children, usuario, onLogout }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="layout-root">
      <Header toggleSidebar={toggleSidebar} usuario={usuario} />
      
      <div className="layout-body">
        <Sidebar isCollapsed={isSidebarCollapsed} onLogout={onLogout} />
        <main className="layout-main">
          {children}
        </main>
      </div>
    </div>
  );
}