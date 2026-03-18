import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase'; 
import Swal from 'sweetalert2';
import './ModalVinculos.css';

export default function ModalVinculos({ 
    isOpen, 
    onClose, 
    productos, 
    aplicaciones, 
    usuarios, 
    recargarDatos, 
    productoInicialId 
}) {
    const [productoFocus, setProductoFocus] = useState(null);
    const [vinculosApp, setVinculosApp] = useState([]);
    const [vinculosUsuario, setVinculosUsuario] = useState([]);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const prodASeleccionar = productoInicialId || (productos.length > 0 ? productos[0].id : null);
            if (prodASeleccionar) {
                seleccionarProductoModal(prodASeleccionar);
            }
        } else {
            setProductoFocus(null);
            setVinculosApp([]);
            setVinculosUsuario([]);
        }
    }, [isOpen, productoInicialId, productos]);

    const seleccionarProductoModal = async (prodId) => {
        setProductoFocus(prodId);
        const { data: appsData } = await supabase.from('producto_aplicacion').select('aplicacion_id').eq('producto_id', prodId);
        const { data: usersData } = await supabase.from('usuario_producto').select('usuario_id').eq('producto_id', prodId);
        
        setVinculosApp(appsData ? appsData.map(a => a.aplicacion_id) : []);
        setVinculosUsuario(usersData ? usersData.map(u => u.usuario_id) : []);
    };

    const toggleVinculo = (id, tipo) => {
        if (tipo === 'app') {
            setVinculosApp(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
        } else {
            setVinculosUsuario(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
        }
    };

    const guardarVinculosTotales = async () => {
        if (!productoFocus) return;
        setGuardando(true);
        try {
            await supabase.from('producto_aplicacion').delete().eq('producto_id', productoFocus);
            await supabase.from('usuario_producto').delete().eq('producto_id', productoFocus);

            if (vinculosApp.length > 0) {
                const insertsApp = vinculosApp.map(appId => ({ producto_id: productoFocus, aplicacion_id: appId }));
                await supabase.from('producto_aplicacion').insert(insertsApp);
            }
            if (vinculosUsuario.length > 0) {
                const insertsUser = vinculosUsuario.map(userId => ({ producto_id: productoFocus, usuario_id: userId }));
                await supabase.from('usuario_producto').insert(insertsUser);
            }

            if (recargarDatos) await recargarDatos();

            const result = await Swal.fire({
                title: '¡Guardado Exitoso!',
                text: 'La configuración de vínculos se ha actualizado correctamente.',
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#2563eb', 
                cancelButtonColor: '#64748b',  
                confirmButtonText: 'Seguir editando',
                cancelButtonText: 'Cerrar ventana',
                reverseButtons: true
            });

            if (!result.isConfirmed) {
                onClose(); 
            }

        } catch (error) {
            Swal.fire('Error', 'Hubo un problema al guardar los cambios.', 'error');
        } finally {
            setGuardando(false);
        }
    };

    if (!isOpen) return null; 

    return (
        <div className="modal-overlay-fullscreen">
            <div className="modal-container-large">
                
                <div className="modal-header-large">
                    <div className="modal-header-info">
                        <div className="modal-header-icon">
                            <span className="material-symbols-outlined">account_tree</span>
                        </div>
                        <div className="modal-header-titles">
                            <h2>Gestor Central de Vínculos</h2>
                            <p>Selecciona un producto y marca qué aplicaciones y usuarios le pertenecen.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-close-modal">
                        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
                    </button>
                </div>

                <div className="modal-body-columns">
                    <div className="modal-column col-productos">
                        <div className="column-header">1. Selecciona un Producto</div>
                        <div className="column-content">
                            {productos.map(prod => (
                                <div 
                                    key={prod.id} 
                                    onClick={() => seleccionarProductoModal(prod.id)}
                                    className={`item-producto ${productoFocus === prod.id ? 'active' : ''}`}
                                >
                                    {prod.nombre}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="modal-column col-aplicaciones">
                        <div className="column-header">2. Asigna Aplicaciones</div>
                        <div className="column-content">
                            {!productoFocus ? (
                                <div className="empty-state">Selecciona un producto primero</div>
                            ) : (
                                aplicaciones.map(app => (
                                    <label key={app.id} className="item-checkbox">
                                        <input 
                                            type="checkbox" 
                                            checked={vinculosApp.includes(app.id)} 
                                            onChange={() => toggleVinculo(app.id, 'app')} 
                                            className="check-input"
                                        />
                                        <span className="item-text-primary">{app.nombre}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="modal-column col-usuarios">
                        <div className="column-header">3. Asigna Usuarios Responsables</div>
                        <div className="column-content">
                            {!productoFocus ? (
                                <div className="empty-state">Selecciona un producto primero</div>
                            ) : (
                                usuarios.map(user => (
                                    <label key={user.id} className={`item-checkbox ${!user.activo ? 'disabled' : ''}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={vinculosUsuario.includes(user.id)} 
                                            onChange={() => toggleVinculo(user.id, 'user')} 
                                            className="check-input"
                                        />
                                        <div style={{ overflow: 'hidden' }}>
                                            <div className="item-text-primary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {user.nombre}
                                            </div>
                                            <div className="item-text-secondary">{user.rol}</div>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="modal-footer-large">
                    <button onClick={onClose} className="btn-cancelar">
                        Cancelar
                    </button>
                    <button 
                        onClick={guardarVinculosTotales} 
                        disabled={!productoFocus || guardando}
                        className="btn-guardar-config"
                    >
                        {guardando ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        </div>
    );
}