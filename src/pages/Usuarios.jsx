import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Swal from 'sweetalert2';
import './Usuarios.css'; 
import ModalVinculos from '../components/ModalVinculos'; 

export default function Usuarios() {
    const [tabActiva, setTabActiva] = useState('usuarios');
    
    const [usuarios, setUsuarios] = useState([]);
    const [productos, setProductos] = useState([]);
    const [aplicaciones, setAplicaciones] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [modalVinculosAbierto, setModalVinculosAbierto] = useState(false);
    const [productoInicial, setProductoInicial] = useState(null);

    useEffect(() => {
        cargarTodo();
    }, []);

    const cargarTodo = async () => {
        setCargando(true);
        await Promise.all([cargarUsuarios(), cargarProductos(), cargarAplicaciones()]);
        setCargando(false);
    };

    const cargarUsuarios = async () => {
        const { data } = await supabase
            .from('usuarios')
            .select(`id, nombre, email, rol, activo, fecha_registro, horario_laboral, usuario_producto ( producto ( id, nombre ) )`)
            .order('activo', { ascending: false })
            .order('nombre', { ascending: true });
        setUsuarios(data || []);
    };

    const cargarProductos = async () => {
        const { data } = await supabase.from('producto').select('*').order('nombre');
        setProductos(data || []);
    };

    const cargarAplicaciones = async () => {
        const { data } = await supabase
            .from('aplicacion')
            .select(`id, nombre, producto_aplicacion ( producto ( id, nombre ) )`)
            .order('nombre');
        setAplicaciones(data || []);
    };

    const abrirModalMaestro = (productoId = null) => {
        setProductoInicial(productoId);
        setModalVinculosAbierto(true);
    };

    const toggleEstadoUsuario = async (id, estadoActual, nombre) => {
        const accion = estadoActual ? 'desactivar' : 'activar';
        const confirmacion = await Swal.fire({
            title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} usuario?`,
            text: `¿Estás seguro de que deseas ${accion} a ${nombre}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: estadoActual ? '#dc2626' : '#16a34a',
            confirmButtonText: `Sí, ${accion}`
        });

        if (confirmacion.isConfirmed) {
            await supabase.from('usuarios').update({ activo: !estadoActual }).eq('id', id);
            cargarUsuarios();
        }
    };

    const badgeStyle = {
        display: 'inline-block', backgroundColor: '#e2e8f0', color: '#334155',
        fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '4px',
        marginRight: '6px', marginBottom: '6px', border: '1px solid #cbd5e1'
    };
    const thStyle = { padding: '14px 16px', textAlign: 'left', backgroundColor: '#f8fafc', color: '#475569', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0' };
    const tdStyle = { padding: '14px 16px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
    const iconBtnStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' };

    return (
        <div className="dashboard-container" style={{ padding: '20px' }}>
            <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>Configuración y Catálogos</h1>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Gestiona tu base de usuarios, productos y aplicaciones.</p>
                </div>
                <button 
                    onClick={() => abrirModalMaestro()} 
                    style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' }}
                >
                    
                    Vincular Catálogos
                </button>
            </header>

            <main style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '20px' }}>
                {/* --- TABS --- */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
                    {['usuarios', 'productos', 'aplicaciones'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setTabActiva(tab)} 
                            style={{ 
                                padding: '12px 24px', fontWeight: 'bold', border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                                backgroundColor: 'transparent', 
                                color: tabActiva === tab ? '#2563eb' : '#64748b',
                                borderBottom: tabActiva === tab ? '3px solid #2563eb' : '3px solid transparent',
                                marginBottom: '-1px', transition: 'all 0.2s'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {cargando ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando información...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            {/* --- TABLA USUARIOS --- */}
                            {tabActiva === 'usuarios' && (
                                <>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Nombre de Usuario</th>
                                            <th style={thStyle}>Rol y Horario</th>
                                            <th style={thStyle}>Productos Vinculados</th>
                                            <th style={{...thStyle, textAlign: 'center'}}>Estado</th>
                                            <th style={{...thStyle, textAlign: 'center'}}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usuarios.map(user => (
                                            <tr key={user.id} style={{ opacity: user.activo ? 1 : 0.6, backgroundColor: 'white' }}>
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '14px' }}>{user.nombre}</div>
                                                    <div style={{ fontSize: '13px', color: '#64748b' }}>{user.email}</div>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{ display: 'inline-block', backgroundColor: user.rol === 'Admin' ? '#fef08a' : '#e0f2fe', color: user.rol === 'Admin' ? '#854d0e' : '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{user.rol}</span>
                                                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span> {user.horario_laboral}
                                                    </div>
                                                </td>
                                                <td style={tdStyle}>
                                                    {user.usuario_producto?.length > 0 ? user.usuario_producto.map(up => <span key={up.producto.id} style={badgeStyle}>{up.producto.nombre}</span>) : <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Sin productos asignados</span>}
                                                </td>
                                                <td style={{...tdStyle, textAlign: 'center'}}>
                                                    <span style={{ display: 'inline-block', backgroundColor: user.activo ? '#dcfce3' : '#fee2e2', color: user.activo ? '#16a34a' : '#dc2626', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                                                        {user.activo ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                                <td style={{...tdStyle, textAlign: 'center'}}>
                                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                        <button title="Editar Usuario" style={{ ...iconBtnStyle, color: '#059669', background: '#d1fae5' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span></button>
                                                        <button onClick={() => toggleEstadoUsuario(user.id, user.activo, user.nombre)} title={user.activo ? 'Desactivar' : 'Activar'} style={{ ...iconBtnStyle, color: user.activo ? '#dc2626' : '#16a34a', background: user.activo ? '#fee2e2' : '#dcfce3' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{user.activo ? 'person_off' : 'person'}</span></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </>
                            )}

                            {tabActiva === 'productos' && (
                                <>
                                    <thead>
                                        <tr>
                                            <th style={{...thStyle, width: '80px'}}>ID</th>
                                            <th style={thStyle}>Nombre del Producto</th>
                                            <th style={{...thStyle, textAlign: 'center', width: '120px'}}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productos.map(prod => (
                                            <tr key={prod.id} style={{ backgroundColor: 'white' }}>
                                                <td style={{...tdStyle, color: '#64748b', fontWeight: 'bold'}}>#{prod.id}</td>
                                                <td style={{...tdStyle, fontWeight: 'bold', color: '#1e293b', fontSize: '15px'}}>{prod.nombre}</td>
                                                <td style={{...tdStyle, textAlign: 'center'}}>
                                                    <button onClick={() => abrirModalMaestro(prod.id)} title="Gestionar Vínculos" style={{ ...iconBtnStyle, color: '#2563eb', background: '#dbeafe', marginRight: '8px' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>hub</span></button>
                                                    <button title="Editar" style={{ ...iconBtnStyle, color: '#059669', background: '#d1fae5' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </>
                            )}

                            {tabActiva === 'aplicaciones' && (
                                <>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Nombre de Aplicación</th>
                                            <th style={thStyle}>Productos Vinculados</th>
                                            <th style={{...thStyle, textAlign: 'center', width: '120px'}}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {aplicaciones.map(app => (
                                            <tr key={app.id} style={{ backgroundColor: 'white' }}>
                                                <td style={{...tdStyle, fontWeight: 'bold', color: '#1e293b', fontSize: '14px'}}>{app.nombre}</td>
                                                <td style={tdStyle}>
                                                    {app.producto_aplicacion?.length > 0 ? app.producto_aplicacion.map(pa => <span key={pa.producto.id} style={badgeStyle}>{pa.producto.nombre}</span>) : <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Sin productos vinculados</span>}
                                                </td>
                                                <td style={{...tdStyle, textAlign: 'center'}}>
                                                    <button title="Editar Aplicación" style={{ ...iconBtnStyle, color: '#059669', background: '#d1fae5' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </>
                            )}
                        </table>
                    </div>
                )}
            </main>

            <ModalVinculos 
                isOpen={modalVinculosAbierto} 
                onClose={() => setModalVinculosAbierto(false)}
                productos={productos}
                aplicaciones={aplicaciones}
                usuarios={usuarios}
                recargarDatos={cargarTodo} 
                productoInicialId={productoInicial}
            />
        </div>
    );
}