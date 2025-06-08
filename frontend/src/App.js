// ==========================================
// APP.JS - FRONTEND COMPLETO Y MEJORADO
// ==========================================
// Reemplaza completamente el contenido de src/App.js con este código

import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, Plus, Trash2, DollarSign, LogOut, Users, BarChart3, Calendar, Eye, Clock, Bell } from 'lucide-react';
import './App.css';

// Configuración de la API
const API_URL = 'http://localhost:3001/api';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [historialCierres, setHistorialCierres] = useState([]);
  const [estadisticas, setEstadisticas] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [puedeHacerCierre, setPuedeHacerCierre] = useState(true);
  const [infoCierre, setInfoCierre] = useState(null);
  
  // Estados para el cierre diario
  const [billetes, setBilletes] = useState({
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
    50: 0
  });
  const [dolares, setDolares] = useState({
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0
  });
  const [usarDolares, setUsarDolares] = useState(false);
  const [tasaCambio, setTasaCambio] = useState(58.50); // Tasa USD a DOP
  const [gastos, setGastos] = useState([]);
  const [nuevoGasto, setNuevoGasto] = useState({ monto: '', comentario: '' });

  const denominaciones = [2000, 1000, 500, 200, 100, 50];
  const denominacionesDolares = [100, 50, 20, 10, 5, 1];
  const MONTO_BASE_CAJA = 4000;

  // ==========================================
  // FUNCIONES DE API
  // ==========================================

  const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      ...options
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
      }

      return data;
    } catch (error) {
      console.error('Error en API:', error);
      throw error;
    }
  };

  const loginAPI = async (credentials) => {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    localStorage.setItem('token', data.token);
    return data.user;
  };

  const obtenerHistorial = async () => {
    const data = await apiCall('/cierres');
    return data;
  };

  const obtenerEstadisticas = async () => {
    const data = await apiCall('/estadisticas');
    return data;
  };

  const guardarCierreAPI = async (cierreData) => {
    const data = await apiCall('/cierres', {
      method: 'POST',
      body: JSON.stringify(cierreData)
    });
    return data;
  };

  const verificarPuedeHacerCierre = async () => {
    try {
      const data = await apiCall('/cierres/puede-cerrar');
      setPuedeHacerCierre(data.puedeCrear);
      setInfoCierre(data);
      return data;
    } catch (error) {
      console.error('Error verificando cierre:', error);
      setPuedeHacerCierre(false);
      return null;
    }
  };

  // ==========================================
  // EFFECTS
  // ==========================================

  // Cargar datos al iniciar
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verificar token válido y cargar usuario
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          setCurrentUser({
            username: payload.username,
            rol: payload.rol,
            nombre: payload.nombre
          });
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        localStorage.removeItem('token');
      }
    }

    // Verificar notificaciones
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  // Cargar datos cuando el usuario esté logueado
  useEffect(() => {
    if (currentUser?.rol === 'administrador') {
      cargarDatosAdmin();
    } else if (currentUser?.rol === 'cajero') {
      verificarPuedeHacerCierre();
    }
  }, [currentUser, cargarDatosAdmin, verificarPuedeHacerCierre]);

  const cargarDatosAdmin = async () => {
    try {
      setLoading(true);
      const [historial, stats] = await Promise.all([
        obtenerHistorial(),
        obtenerEstadisticas()
      ]);
      setHistorialCierres(historial);
      setEstadisticas(stats);
    } catch (error) {
      setError('Error al cargar datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sistema de notificaciones
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkTime = () => {
      const now = new Date();
      const rdTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
      const hours = rdTime.getHours();
      const minutes = rdTime.getMinutes();
      
      if (hours === 19 && minutes === 58 && !notificationSent) {
        showNotification();
        setNotificationSent(true);
      }
      
      if (hours === 0 && minutes === 0) {
        setNotificationSent(false);
      }
    };

    const notificationTimer = setInterval(checkTime, 30000);
    return () => clearInterval(notificationTimer);
  }, [notificationsEnabled, notificationSent, showNotification]);

  // ==========================================
  // FUNCIONES DE NEGOCIO
  // ==========================================

  const login = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const user = await loginAPI(loginForm);
      setCurrentUser(user);
      setLoginForm({ username: '', password: '' });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [loginForm]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    setHistorialCierres([]);
    setEstadisticas({});
    resetearCierre();
  }, [resetearCierre]);

  const calcularTotalBilletes = useCallback(() => {
    return denominaciones.reduce((total, denom) => {
      return total + (billetes[denom] * denom);
    }, 0);
  }, [billetes]);

  const calcularTotalDolares = useCallback(() => {
    const totalUSD = denominacionesDolares.reduce((total, denom) => {
      return total + (dolares[denom] * denom);
    }, 0);
    return totalUSD * tasaCambio; // Convertir a pesos dominicanos
  }, [dolares, tasaCambio]);

  const calcularTotalGastos = useCallback(() => {
    return gastos.reduce((total, gasto) => total + parseFloat(gasto.monto || 0), 0);
  }, [gastos]);

  const handleBilleteChange = (denominacion, cantidad) => {
    setBilletes(prev => ({
      ...prev,
      [denominacion]: parseInt(cantidad) || 0
    }));
  };

  const handleDolarChange = (denominacion, cantidad) => {
    setDolares(prev => ({
      ...prev,
      [denominacion]: parseInt(cantidad) || 0
    }));
  };

  const toggleDolares = () => {
    setUsarDolares(!usarDolares);
    if (!usarDolares) {
      // Si se está activando, resetear dólares
      setDolares({
        100: 0,
        50: 0,
        20: 0,
        10: 0,
        5: 0,
        1: 0
      });
    }
  };

  const agregarGasto = () => {
    if (nuevoGasto.monto && nuevoGasto.comentario.trim()) {
      setGastos(prev => [...prev, {
        id: Date.now(),
        monto: parseFloat(nuevoGasto.monto),
        comentario: nuevoGasto.comentario,
        fecha: new Date().toLocaleTimeString()
      }]);
      setNuevoGasto({ monto: '', comentario: '' });
    }
  };

  const eliminarGasto = (id) => {
    setGastos(prev => prev.filter(gasto => gasto.id !== id));
  };

  const guardarCierre = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Verificar nuevamente si se puede hacer cierre
      const verificacion = await verificarPuedeHacerCierre();
      if (!verificacion?.puedeCrear) {
        setError('No se puede realizar otro cierre hoy. El próximo cierre estará disponible después de las 12:00 PM del día siguiente.');
        return;
      }

      const totalBilletesContados = calcularTotalBilletes();
      const totalDolaresEnPesos = usarDolares ? calcularTotalDolares() : 0;
      const totalGastos = calcularTotalGastos();
      const totalEnCaja = MONTO_BASE_CAJA + totalBilletesContados + totalDolaresEnPesos;
      const saldoFinal = totalEnCaja - totalGastos;

      const cierreData = {
        billetes: { ...billetes },
        dolares: usarDolares ? { ...dolares } : null,
        usarDolares,
        tasaCambio: usarDolares ? tasaCambio : null,
        gastos: [...gastos],
        montoBase: MONTO_BASE_CAJA,
        totalBilletesContados,
        totalDolaresEnPesos,
        totalEnCaja,
        totalGastos,
        saldoFinal
      };

      const resultado = await guardarCierreAPI(cierreData);
      resetearCierre();
      
      // Actualizar estado de cierre
      setPuedeHacerCierre(false);
      await verificarPuedeHacerCierre();
      
      alert(`Cierre guardado exitosamente para el día operativo: ${resultado.fechaOperativa}`);

      // Recargar datos si es admin
      if (currentUser?.rol === 'administrador') {
        await cargarDatosAdmin();
      }
    } catch (error) {
      if (error.message.includes('CIERRE_YA_REALIZADO')) {
        setError('Ya se realizó el cierre del día operativo actual. El próximo cierre estará disponible después de las 12:00 PM del día siguiente.');
        await verificarPuedeHacerCierre();
      } else {
        setError('Error al guardar cierre: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [
    verificarPuedeHacerCierre,
    calcularTotalBilletes,
    calcularTotalDolares,
    calcularTotalGastos,
    usarDolares,
    billetes,
    dolares,
    tasaCambio,
    gastos,
    resetearCierre,
    currentUser,
    cargarDatosAdmin
  ]);

  const resetearCierre = () => {
    setBilletes({
      2000: 0,
      1000: 0,
      500: 0,
      200: 0,
      100: 0,
      50: 0
    });
    setDolares({
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
      1: 0
    });
    setGastos([]);
    setNuevoGasto({ monto: '', comentario: '' });
  };

  // Funciones de notificaciones memoizadas
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      alert('Este navegador no soporta notificaciones');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      alert('¡Notificaciones habilitadas! Te recordaré hacer el cuadre a las 7:58 PM');
    } else {
      alert('Notificaciones denegadas. No podrás recibir recordatorios.');
    }
  }, []);

  const showNotification = useCallback(() => {
    if (Notification.permission === 'granted') {
      const notification = new Notification('🕰️ Hora del Cuadre de Caja', {
        body: 'Son las 7:58 PM. Es hora de hacer el cuadre diario de caja chica.',
        icon: '/favicon.ico',
        tag: 'cuadre-caja',
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 10000);
    }
  }, []);

  const getRDTime = useCallback(() => {
    return currentTime.toLocaleString("es-DO", {
      timeZone: "America/Santo_Domingo",
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, [currentTime]);

  const getRDDate = useCallback(() => {
    return currentTime.toLocaleDateString("es-DO", {
      timeZone: "America/Santo_Domingo",
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [currentTime]);

  const formatearProximoCierre = useCallback((fechaISO) => {
    if (!fechaISO) return '';
    
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString("es-DO", {
      timeZone: "America/Santo_Domingo",
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // ==========================================
  // EFFECTS
  // ==========================================

  // Cargar datos al iniciar
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verificar token válido y cargar usuario
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          setCurrentUser({
            username: payload.username,
            rol: payload.rol,
            nombre: payload.nombre
          });
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        localStorage.removeItem('token');
      }
    }

    // Verificar notificaciones
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  // Cargar datos cuando el usuario esté logueado
  useEffect(() => {
    if (currentUser?.rol === 'administrador') {
      cargarDatosAdmin();
    } else if (currentUser?.rol === 'cajero') {
      verificarPuedeHacerCierre();
    }
  }, [currentUser, cargarDatosAdmin, verificarPuedeHacerCierre]);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sistema de notificaciones
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkTime = () => {
      const now = new Date();
      const rdTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
      const hours = rdTime.getHours();
      const minutes = rdTime.getMinutes();
      
      if (hours === 19 && minutes === 58 && !notificationSent) {
        showNotification();
        setNotificationSent(true);
      }
      
      if (hours === 0 && minutes === 0) {
        setNotificationSent(false);
      }
    };

    const notificationTimer = setInterval(checkTime, 30000);
    return () => clearInterval(notificationTimer);
  }, [notificationsEnabled, notificationSent, showNotification]);

  // Guardar historial cuando cambie
  useEffect(() => {
    if (typeof Storage !== 'undefined') {
      localStorage.setItem('historialCierres', JSON.stringify(historialCierres));
    }
  }, [historialCierres]);

  // ==========================================
  // CÁLCULOS FINALES
  // ==========================================

  // Calcular totales usando funciones memoizadas
  const totalBilletesContados = calcularTotalBilletes();
  const totalDolaresEnPesos = usarDolares ? calcularTotalDolares() : 0;
  const totalGastos = calcularTotalGastos();
  const totalEnCaja = MONTO_BASE_CAJA + totalBilletesContados + totalDolaresEnPesos;
  const saldoFinal = totalEnCaja - totalGastos;

  // ==========================================
  // RENDER - LOGIN
  // ==========================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
        {/* Reloj en pantalla de login */}
        <div className="fixed top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-blue-600" />
            <div className="text-center">
              <div className="font-bold text-blue-800">{getRDTime()}</div>
              <div className="text-xs text-gray-600">República Dominicana</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Calculator className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">Sistema Caja Chica</h1>
            <p className="text-gray-600">Ingresa tus credenciales</p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full"
                placeholder="admin o cajero"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full"
                placeholder="Contraseña"
                onKeyPress={(e) => e.key === 'Enter' && !loading && login()}
                disabled={loading}
              />
            </div>
            <button
              onClick={login}
              disabled={loading}
              className="w-full btn-primary"
            >
              {loading ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </div>
          
          <div className="mt-6 text-xs text-gray-500 text-center">
            <p>Usuarios de prueba:</p>
            <p>admin / admin123 (Administrador)</p>
            <p>cajero / cajero123 (Cajero)</p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER - VISTA ADMINISTRADOR
  // ==========================================
  if (currentUser.rol === 'administrador') {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-green-600 h-8 w-8" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Panel Administrativo</h1>
                <p className="text-gray-600">Bienvenido, {currentUser.nombre}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Reloj RD */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-800">{getRDTime()}</div>
                    <div className="text-xs text-gray-600">{getRDDate()}</div>
                  </div>
                </div>
              </div>
              
              {/* Botón de notificaciones */}
              {!notificationsEnabled && (
                <button
                  onClick={requestNotificationPermission}
                  className="btn-warning text-sm"
                >
                  <Bell className="w-4 h-4" />
                  Activar Recordatorio
                </button>
              )}
              
              {notificationsEnabled && (
                <div className="flex items-center gap-2 bg-green-100 text-green-800 py-2 px-3 rounded-md text-sm">
                  <Bell className="w-4 h-4" />
                  Recordatorio activo (7:58 PM)
                </div>
              )}
              
              <button
                onClick={logout}
                className="btn-danger"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Cargando...</p>
          </div>
        )}

        {/* Estadísticas Generales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="flex items-center gap-3">
              <Calendar className="text-blue-600 h-8 w-8" />
              <div>
                <p className="text-sm text-gray-600">Total Cierres</p>
                <p className="text-2xl font-bold text-blue-600">{estadisticas.totalCierres || 0}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <DollarSign className="text-green-600 h-8 w-8" />
              <div>
                <p className="text-sm text-gray-600">Saldo Acumulado</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(estadisticas.totalAcumulado || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <Trash2 className="text-red-600 h-8 w-8" />
              <div>
                <p className="text-sm text-gray-600">Gastos Totales</p>
                <p className="text-2xl font-bold text-red-600">
                  ${(estadisticas.totalGastos || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <Users className="text-purple-600 h-8 w-8" />
              <div>
                <p className="text-sm text-gray-600">Último Cierre</p>
                <p className="text-lg font-bold text-purple-600">
                  {estadisticas.ultimoCierre || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Historial de Cierres */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Eye className="text-blue-600" />
              Historial de Cierres
            </h2>
          </div>
          
          {historialCierres.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay cierres registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contados</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gastos</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saldo Final</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalles</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historialCierres.map((cierre) => (
                    <tr key={cierre.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(cierre.fecha_cierre).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cierre.usuario_nombre}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                        ${cierre.monto_base.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        ${cierre.total_billetes_contados.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        ${cierre.total_gastos.toLocaleString()}
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold ${
                        cierre.saldo_final >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${cierre.saldo_final.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <details className="text-sm">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            Ver detalles
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 rounded">
                            <div className="mb-2">
                              <strong>Monto Base:</strong> ${cierre.monto_base.toLocaleString()}
                            </div>
                            <div className="mb-2">
                              <strong>Billetes DOP:</strong>
                              {denominaciones.map(denom => (
                                cierre.billetes[denom] > 0 && (
                                  <div key={denom} className="text-xs">
                                    ${denom}: {cierre.billetes[denom]} billetes = ${(denom * cierre.billetes[denom]).toLocaleString()}
                                  </div>
                                )
                              ))}
                            </div>
                            {cierre.usar_dolares && cierre.dolares && (
                              <div className="mb-2">
                                <strong>Dólares USD (Tasa: {cierre.tasa_cambio}):</strong>
                                {denominacionesDolares.map(denom => (
                                  cierre.dolares[denom] > 0 && (
                                    <div key={denom} className="text-xs">
                                      ${denom} USD: {cierre.dolares[denom]} billetes = ${(denom * cierre.dolares[denom] * cierre.tasa_cambio).toLocaleString()} DOP
                                    </div>
                                  )
                                ))}
                                <div className="text-xs font-semibold mt-1 text-green-600">
                                  Total USD: ${Object.entries(cierre.dolares).reduce((total, [denom, cantidad]) => total + (parseInt(denom) * cantidad), 0)} = ${(cierre.total_dolares_pesos || 0).toLocaleString()} DOP
                                </div>
                              </div>
                            )}
                            {cierre.gastos.length > 0 && (
                              <div>
                                <strong>Gastos:</strong>
                                {cierre.gastos.map(gasto => (
                                  <div key={gasto.id} className="text-xs">
                                    ${gasto.monto} - {gasto.comentario}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER - VISTA CAJERO
  // ==========================================
  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="card">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Información de estado del cierre */}
        {!puedeHacerCierre && infoCierre && (
          <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5" />
              <strong>Cierre del día completado</strong>
            </div>
            <p className="text-sm mb-2">
              Ya se realizó el cierre para el día operativo: <strong>{infoCierre.fechaCierreExistente}</strong>
            </p>
            {infoCierre.proximoCierrePermitido && (
              <p className="text-sm">
                <strong>Próximo cierre disponible:</strong><br />
                {formatearProximoCierre(infoCierre.proximoCierrePermitido)}
              </p>
            )}
          </div>
        )}

        {puedeHacerCierre && infoCierre && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-5 h-5" />
              <strong>Cierre disponible</strong>
            </div>
            <p className="text-sm">
              Día operativo: <strong>{infoCierre.fechaOperativa}</strong>
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calculator className="text-blue-600 h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Cierre Diario - Caja Chica</h1>
              <p className="text-gray-600">Cajero: {currentUser.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Reloj RD */}
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-800">{getRDTime()}</div>
                  <div className="text-xs text-gray-600">RD - {new Date().toLocaleDateString()}</div>
                </div>
              </div>
            </div>
            
            {/* Botón de notificaciones */}
            {!notificationsEnabled && (
              <button
                onClick={requestNotificationPermission}
                className="btn-warning text-sm"
              >
                <Bell className="w-4 h-4" />
                Activar Recordatorio
              </button>
            )}
            
            {notificationsEnabled && (
              <div className="flex items-center gap-2 bg-green-100 text-green-800 py-2 px-3 rounded-md text-sm">
                <Bell className="w-4 h-4" />
                Recordatorio 7:58 PM
              </div>
            )}
            
            <button
              onClick={logout}
              className="btn-danger"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Conteo de Billetes */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-blue-800 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Conteo de Billetes
                </h2>
                <button
                  onClick={toggleDolares}
                  className={`text-sm px-3 py-1 rounded-md ${
                    usarDolares 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {usarDolares ? '💵 Dólares ON' : '💵 Agregar Dólares'}
                </button>
              </div>
            </div>
            
            {/* Billetes en Pesos */}
            <div className="mb-4">
              <h3 className="text-lg font-medium text-blue-700 mb-3">Pesos Dominicanos (DOP)</h3>
              <div className="space-y-3">
                {denominaciones.map(denom => (
                  <div key={denom} className="billete-row">
                    <label className="billete-label">
                      ${denom}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={billetes[denom]}
                      onChange={(e) => handleBilleteChange(denom, e.target.value)}
                      className="billete-input"
                      placeholder="0"
                      disabled={loading}
                    />
                    <span className="billete-text">billetes</span>
                    <span className="billete-total">
                      ${(billetes[denom] * denom).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sección de Dólares (Opcional) */}
            {usarDolares && (
              <div className="mb-4 border-t border-blue-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-green-700">Dólares Estadounidenses (USD)</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Tasa:</span>
                    <input
                      type="number"
                      step="0.01"
                      value={tasaCambio}
                      onChange={(e) => setTasaCambio(parseFloat(e.target.value) || 58.50)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                      disabled={loading}
                    />
                    <span className="text-sm text-gray-600">DOP</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {denominacionesDolares.map(denom => (
                    <div key={denom} className="billete-row">
                      <label className="billete-label text-green-700">
                        ${denom} USD
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={dolares[denom]}
                        onChange={(e) => handleDolarChange(denom, e.target.value)}
                        className="billete-input"
                        placeholder="0"
                        disabled={loading}
                      />
                      <span className="billete-text">billetes</span>
                      <span className="billete-total text-green-600">
                        ${(dolares[denom] * denom * tasaCambio).toLocaleString()} DOP
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-2 bg-green-100 rounded text-sm">
                  <strong>Total USD:</strong> ${denominacionesDolares.reduce((total, denom) => total + (dolares[denom] * denom), 0)} 
                  <span className="ml-2 text-green-700">
                    = ${totalDolaresEnPesos.toLocaleString()} DOP
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-blue-200 space-y-2">
              <div className="flex justify-between items-center text-sm text-blue-700">
                <span>Monto Base Diario:</span>
                <span className="font-semibold">${MONTO_BASE_CAJA.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-blue-700">
                <span>Billetes DOP Contados:</span>
                <span className="font-semibold">${totalBilletesContados.toLocaleString()}</span>
              </div>
              {usarDolares && (
                <div className="flex justify-between items-center text-sm text-green-700">
                  <span>Dólares (en DOP):</span>
                  <span className="font-semibold">${totalDolaresEnPesos.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-bold text-blue-800 pt-2 border-t border-blue-300">
                <span>Total en Caja:</span>
                <span>${totalEnCaja.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Gastos de Caja Chica */}
          <div className="bg-red-50 rounded-lg p-4">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-red-800">Gastos de Caja Chica</h2>
            </div>
            
            {/* Agregar nuevo gasto */}
            <div className="mb-4 space-y-3">
              <input
                type="number"
                step="0.01"
                placeholder="Monto del gasto"
                value={nuevoGasto.monto}
                onChange={(e) => setNuevoGasto(prev => ({ ...prev, monto: e.target.value }))}
                className="w-full"
                disabled={loading}
              />
              <input
                type="text"
                placeholder="Comentario obligatorio"
                value={nuevoGasto.comentario}
                onChange={(e) => setNuevoGasto(prev => ({ ...prev, comentario: e.target.value }))}
                className="w-full"
                disabled={loading}
              />
              <button
                onClick={agregarGasto}
                disabled={!nuevoGasto.monto || !nuevoGasto.comentario.trim() || loading}
                className="w-full btn-danger"
              >
                <Plus className="w-4 h-4" />
                Agregar Gasto
              </button>
            </div>

            {/* Lista de gastos */}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {gastos.map(gasto => (
                <div key={gasto.id} className="gasto-item">
                  <div className="gasto-info">
                    <div className="gasto-monto">${gasto.monto.toLocaleString()}</div>
                    <div className="gasto-comentario">{gasto.comentario}</div>
                    <div className="gasto-fecha">{gasto.fecha}</div>
                  </div>
                  <button
                    onClick={() => eliminarGasto(gasto.id)}
                    className="text-red-500 hover:text-red-700 ml-2 p-1"
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-red-200">
              <div className="flex justify-between items-center text-lg font-bold text-red-800">
                <span>Total Gastos:</span>
                <span>${totalGastos.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen Final */}
        <div className="mt-6 bg-green-50 rounded-lg p-4">
          <div className="card-header">
            <h2 className="text-xl font-semibold text-green-800">Resumen del Cierre</h2>
          </div>
          <div className={`grid grid-cols-1 gap-4 text-center ${usarDolares ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            <div className="bg-white rounded p-3">
              <div className="text-sm text-gray-600">Monto Base</div>
              <div className="text-2xl font-bold text-purple-600">${MONTO_BASE_CAJA.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-sm text-gray-600">Billetes DOP</div>
              <div className="text-2xl font-bold text-blue-600">${totalBilletesContados.toLocaleString()}</div>
            </div>
            {usarDolares && (
              <div className="bg-white rounded p-3">
                <div className="text-sm text-gray-600">Dólares USD</div>
                <div className="text-lg font-bold text-green-600">
                  ${denominacionesDolares.reduce((total, denom) => total + (dolares[denom] * denom), 0)} USD
                </div>
                <div className="text-sm text-green-600">
                  ${totalDolaresEnPesos.toLocaleString()} DOP
                </div>
              </div>
            )}
            <div className="bg-white rounded p-3">
              <div className="text-sm text-gray-600">Total Gastos</div>
              <div className="text-2xl font-bold text-red-600">-${totalGastos.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-sm text-gray-600">Saldo Final</div>
              <div className={`text-2xl font-bold ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${saldoFinal.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="mt-3 text-center text-sm text-gray-600">
            Cálculo: ${MONTO_BASE_CAJA.toLocaleString()} (base) + ${totalBilletesContados.toLocaleString()} (pesos) 
            {usarDolares && ` + ${totalDolaresEnPesos.toLocaleString()} (dólares)`} 
            - ${totalGastos.toLocaleString()} (gastos) = ${saldoFinal.toLocaleString()}
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="mt-6 flex gap-4 justify-center">
          <button
            onClick={resetearCierre}
            disabled={loading}
            className="btn-limpiar"
          >
            Limpiar
          </button>
          
          {!puedeHacerCierre && (
            <button
              onClick={verificarPuedeHacerCierre}
              disabled={loading}
              className="btn-primary"
            >
              <Clock className="w-4 h-4" />
              Verificar Disponibilidad
            </button>
          )}
          
          <button
            onClick={guardarCierre}
            disabled={loading || !puedeHacerCierre}
            className="btn-guardar"
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            {loading ? 'Guardando...' : puedeHacerCierre ? 'Guardar Cierre' : 'Cierre No Disponible'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
