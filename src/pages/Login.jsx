import React, { useState } from 'react';
import { supabase } from '../services/supabase'; 
import Swal from 'sweetalert2';
import './Login.css';

export default function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mostrarPassword, setMostrarPassword] = useState(false);
    const [cargando, setCargando] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!email || !password) {
            Swal.fire({ icon: 'warning', title: 'Atención', text: 'Por favor, completa ambos campos.' });
            return;
        }

        setCargando(true);

        try {
            const correoLimpio = email.trim();

            const { data, error } = await supabase
                .from('usuarios')
                .select('*')
                .ilike('email', correoLimpio) 
                .eq('password', password)
                .maybeSingle(); 

            if (error || !data) {
                console.log("Error o sin datos:", error);
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Acceso denegado', 
                    text: 'Correo electrónico o contraseña incorrectos.',
                    confirmButtonColor: '#ec5b13'
                });
                return;
            }

            if (data.activo === false) {
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Cuenta inactiva', 
                    text: 'Tu cuenta ha sido desactivada. Habla con tu administrador.',
                    confirmButtonColor: '#ec5b13'
                });
                return;
            }

            const usuarioAutenticado = {
                id: data.id,
                nombre: data.nombre,
                email: data.email,
                rol: data.rol
            };
            
            localStorage.setItem('usuario_sesion', JSON.stringify(usuarioAutenticado));

            if (onLoginSuccess) {
                onLoginSuccess(usuarioAutenticado);
            } else {
                window.location.reload(); 
            }

        } catch (error) {
            console.error('Error de login:', error);
            Swal.fire({ icon: 'error', title: 'Error del servidor', text: 'No se pudo conectar con la base de datos.' });
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-top-bar"></div>
            
            <div className="login-container">
                <div className="login-header">
                    <h1 className="login-title">Service Desk</h1>
                </div>

                <div className="login-card">
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h2 className="card-title">Bienvenido de nuevo</h2>
                        <p className="card-subtitle">Introduce tus credenciales para acceder a tu espacio de trabajo</p>
                    </div>

                    <form className="login-form" onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Correo electrónico</label>
                            <div className="input-wrapper">
                                <div className="input-icon-left">
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>mail</span>
                                </div>
                                <input 
                                    className="form-control" 
                                    id="email" 
                                    type="email" 
                                    placeholder="admin@tuempresa.com" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <div className="form-header">
                                <label className="form-label" htmlFor="password">Contraseña</label>
                            </div>
                            <div className="input-wrapper">
                                <div className="input-icon-left">
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>lock</span>
                                </div>
                                <input 
                                    className="form-control" 
                                    id="password" 
                                    type={mostrarPassword ? "text" : "password"} 
                                    placeholder="••••••••" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button 
                                    className="input-icon-right" 
                                    type="button"
                                    onClick={() => setMostrarPassword(!mostrarPassword)}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                        {mostrarPassword ? "visibility_off" : "visibility"}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="remember-group">
                            <input className="remember-checkbox" id="remember" type="checkbox" />
                            <label className="remember-label" htmlFor="remember">Mantenerme conectado</label>
                        </div>

                        <button className="btn-submit" type="submit" disabled={cargando}>
                            {cargando ? 'Verificando...' : 'Iniciar sesión'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}