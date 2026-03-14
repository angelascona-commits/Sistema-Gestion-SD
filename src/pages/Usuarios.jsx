import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Swal from 'sweetalert2';
import './Usuarios.css'; // Usaremos las clases globales y un par nuevas

export default function Usuarios() {
    const [usuarios, setUsuarios] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        cargarUsuarios();
    }, []);

    const cargarUsuarios = async () => {
        try {
            setCargando(true);
            const { data, error } = await supabase
                .from('usuarios')
                .select('id, nombre, email, rol, activo, fecha_registro, horario_laboral')
                .order('activo', { ascending: false }) // Los activos primero
                .order('nombre', { ascending: true });

            if (error) throw error;
            setUsuarios(data || []);
        } catch (error) {
            console.error("Error cargando usuarios:", error.message);
            Swal.fire('Error', 'No se pudieron cargar los usuarios', 'error');
        } finally {
            setCargando(false);
        }
    };

    const toggleEstadoUsuario = async (id, estadoActual, nombre) => {
        const accion = estadoActual ? 'desactivar' : 'activar';
        const confirmacion = await Swal.fire({
            title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} usuario?`,
            text: `¿Estás seguro de que deseas ${accion} a ${nombre}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ea580c',
            cancelButtonColor: '#64748b',
            confirmButtonText: `Sí, ${accion}`,
            cancelButtonText: 'Cancelar'
        });

        if (confirmacion.isConfirmed) {
            try {
                const { error } = await supabase
                    .from('usuarios')
                    .update({ activo: !estadoActual })
                    .eq('id', id);

                if (error) throw error;
                
                Swal.fire({
                    icon: 'success',
                    title: 'Estado actualizado',
                    timer: 1500,
                    showConfirmButton: false
                });
                cargarUsuarios();
            } catch (error) {
                console.error("Error actualizando estado:", error);
                Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
            }
        }
    };

    const handleNuevoUsuario = () => {
        // Aquí luego puedes abrir un modal similar a TicketModal para crear el usuario
        Swal.fire({
            icon: 'info',
            title: 'Nuevo Usuario',
            text: 'Aquí se abrirá el modal para crear un nuevo usuario.',
            confirmButtonColor: '#ea580c'
        });
    };

    if (cargando) {
        return (
            <div className="spinner-container">
                <div className="spinner"></div>
                <span className="spinner-text">Cargando directorio de usuarios...</span>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dash-header">
                <div>
                    <h1 className="dash-title">Gestión de Usuarios</h1>
                    <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.9rem' }}>
                        Administra los accesos, roles y horarios de tu equipo.
                    </p>
                </div>
            </div>

            <div className="dash-content">
                <section>
                    <div className="table-container">
                        <table className="ticket-table user-table">
                            <thead>
                                <tr>
                                    <th>Nombre del Usuario</th>
                                    <th>Correo Electrónico</th>
                                    <th className="text-center">Rol del Sistema</th>
                                    <th className="text-center">Horario Laboral</th>
                                    <th className="text-center">Estado</th>
                                    <th className="text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center empty-state">No hay usuarios registrados.</td>
                                    </tr>
                                ) : (
                                    usuarios.map((user) => (
                                        <tr key={user.id} className={!user.activo ? 'row-inactive' : ''}>
                                            <td className="t-user-name">
                                                <div className="user-info-cell">
                                                    <div className="user-avatar">
                                                        {user.nombre.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-bold">{user.nombre}</span>
                                                </div>
                                            </td>
                                            <td className="t-email">{user.email}</td>
                                            <td className="text-center">
                                                <span className={`role-badge ${user.rol === 'Administrador' ? 'role-admin' : 'role-agent'}`}>
                                                    {user.rol}
                                                </span>
                                            </td>
                                            <td className="text-center font-bold" style={{ color: '#475569' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'text-bottom', marginRight: '4px', color: '#94a3b8' }}>
                                                    schedule
                                                </span>
                                                {user.horario_laboral || 'Sin asignar'}
                                            </td>
                                            <td className="text-center">
                                                <span className={`status-pill ${user.activo ? 'status-resolved' : 'status-open'}`}>
                                                    {user.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <div className="action-buttons">
                                                    <button className="btn-icon btn-edit" title="Editar Usuario">
                                                        <span className="material-symbols-outlined">edit</span>
                                                    </button>
                                                    <button 
                                                        className={`btn-icon ${user.activo ? 'btn-delete' : 'btn-restore'}`} 
                                                        title={user.activo ? 'Desactivar' : 'Activar'}
                                                        onClick={() => toggleEstadoUsuario(user.id, user.activo, user.nombre)}
                                                    >
                                                        <span className="material-symbols-outlined">
                                                            {user.activo ? 'person_off' : 'person'}
                                                        </span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}