import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import Login from './pages/Login'; 
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  useEffect(() => {
    const sesionGuardada = localStorage.getItem('usuario_sesion');
    if (sesionGuardada) {
      setUsuario(JSON.parse(sesionGuardada));
    }
    setCargandoSesion(false); 
  }, []);
  const handleLogout = () => {
    localStorage.removeItem('usuario_sesion'); 
    setUsuario(null); 
};
  if (cargandoSesion) {
    return <div style={{ height: '100vh', backgroundColor: '#f8f6f6' }}></div>; 
  }

  if (!usuario) {
    return <Login onLoginSuccess={(datosUsuario) => setUsuario(datosUsuario)} />;
  }

  return (
    <BrowserRouter>
      <Layout usuario={usuario} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/Dashboard" replace />} />
          
          <Route path="/Dashboard" element={<Dashboard />} />
          <Route path="/Tickets" element={<Tickets />} />
          <Route path="/Reportes" element={<Reportes />} />
          <Route path="/Usuarios" element={<Usuarios />} />
          <Route path="*" element={<Navigate to="/Dashboard" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;