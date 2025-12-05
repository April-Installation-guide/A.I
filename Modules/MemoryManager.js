// ========== SISTEMA DE MEMORIA MEJORADO ==========
export class MemoryManager {
    constructor(maxHistory = 270) {
        this.memory = new Map(); // userId -> array de mensajes
        this.maxHistory = maxHistory; // Límite por usuario
        this.stats = {
            totalUsuarios: 0,
            totalMensajes: 0,
            llamadasAPI: 0
        };
        
        console.log(`🧠 Sistema de memoria activado (${maxHistory} mensajes/usuario)`);
    }
    
    // ========== GESTIÓN DE HISTORIAL ==========
    
    // Obtener historial de un usuario
    obtenerHistorialUsuario(userId) {
        if (!this.memory.has(userId)) {
            return [];
        }
        
        return this.memory.get(userId);
    }
    
    // Agregar mensaje al historial
    agregarAlHistorial(userId, rol, contenido) {
        try {
            // Validar parámetros
            if (!userId || !rol || !contenido) {
                console.error('❌ Parámetros inválidos para agregar al historial');
                return false;
            }
            
            // Inicializar array si no existe
            if (!this.memory.has(userId)) {
                this.memory.set(userId, []);
                this.stats.totalUsuarios++;
            }
            
            const historial = this.memory.get(userId);
            
            // Crear objeto de mensaje
            const mensaje = {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                rol: rol,
                contenido: contenido,
                timestamp: new Date().toISOString(),
                procesado: false
            };
            
            // Agregar al inicio (para mantener orden cronológico inverso)
            historial.unshift(mensaje);
            
            // Limitar tamaño del historial
            if (historial.length > this.maxHistory) {
                historial.splice(this.maxHistory, historial.length - this.maxHistory);
            }
            
            // Actualizar estadísticas
            this.stats.totalMensajes++;
            
            console.log(`📝 Memoria: ${userId} → ${rol} (${historial.length}/${this.maxHistory})`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Error agregando al historial:', error);
            return false;
        }
    }
    
    // ========== OPERACIONES AVANZADAS ==========
    
    // Buscar en el historial de un usuario
    buscarEnHistorial(userId, consulta) {
        if (!this.memory.has(userId)) {
            return [];
        }
        
        const historial = this.memory.get(userId);
        const resultados = [];
        const consultaLower = consulta.toLowerCase();
        
        // Buscar en los últimos 50 mensajes
        for (let i = 0; i < Math.min(50, historial.length); i++) {
            const mensaje = historial[i];
            if (mensaje.contenido.toLowerCase().includes(consultaLower)) {
                resultados.push({
                    ...mensaje,
                    indice: i,
                    relevancia: this.calcularRelevancia(mensaje.contenido, consulta)
                });
            }
        }
        
        // Ordenar por relevancia
        resultados.sort((a, b) => b.relevancia - a.relevancia);
        
        return resultados.slice(0, 5); // Devolver top 5
    }
    
    // Calcular relevancia de búsqueda
    calcularRelevancia(texto, consulta) {
        const textoLower = texto.toLowerCase();
        const consultaLower = consulta.toLowerCase();
        
        let puntuacion = 0;
        
        // Coincidencia exacta
        if (textoLower === consultaLower) {
            puntuacion += 100;
        }
        
        // Coincidencia de palabras completas
        const palabrasConsulta = consultaLower.split(' ');
        const palabrasTexto = textoLower.split(' ');
        
        for (const palabra of palabrasConsulta) {
            if (palabrasTexto.includes(palabra)) {
                puntuacion += 10;
            }
        }
        
        // Coincidencia parcial
        if (textoLower.includes(consultaLower)) {
            puntuacion += 5;
        }
        
        // Priorizar mensajes más recientes (implícito por el orden)
        
        return puntuacion;
    }
    
    // Obtener resumen de conversación
    obtenerResumenConversacion(userId) {
        if (!this.memory.has(userId) || this.memory.get(userId).length === 0) {
            return "Sin historial de conversación.";
        }
        
        const historial = this.memory.get(userId);
        
        // Tomar los últimos 10 mensajes
        const mensajesRecientes = historial.slice(0, Math.min(10, historial.length));
        
        // Contar roles
        const conteoRoles = {};
        mensajesRecientes.forEach(msg => {
            conteoRoles[msg.rol] = (conteoRoles[msg.rol] || 0) + 1;
        });
        
        // Extraer temas frecuentes (palabras clave simples)
        const palabrasComunes = this.extraerPalabrasClave(mensajesRecientes);
        
        return {
            totalMensajes: historial.length,
            mensajesRecientes: mensajesRecientes.length,
            distribucionRoles: conteoRoles,
            palabrasClave: palabrasComunes.slice(0, 5),
            ultimaInteraccion: historial[0]?.timestamp || "Nunca"
        };
    }
    
    // Extraer palabras clave simples
    extraerPalabrasClave(mensajes) {
        const palabrasExcluidas = new Set([
            'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
            'de', 'del', 'al', 'con', 'por', 'para', 'en', 'a',
            'que', 'qué', 'y', 'o', 'u', 'e', 'pero', 'mas', 'más',
            'es', 'son', 'fue', 'era', 'soy', 'eres', 'este', 'esta',
            'esto', 'estos', 'estas', 'algo', 'nada', 'todo', 'todos',
            'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos',
            'mi', 'tu', 'su', 'nuestro', 'vuestro', 'su', 'muy',
            'mucho', 'poco', 'menos', 'más', 'tan', 'tanto',
            'como', 'cuando', 'donde', 'dónde', 'porque', 'por qué',
            'si', 'no', 'sí', 'tal', 'cual', 'cuales'
        ]);
        
        const frecuencia = {};
        
        mensajes.forEach(mensaje => {
            const palabras = mensaje.contenido
                .toLowerCase()
                .replace(/[^\w\sáéíóúüñ]/g, ' ')
                .split(/\s+/)
                .filter(palabra => 
                    palabra.length > 3 && 
                    !palabrasExcluidas.has(palabra) &&
                    isNaN(palabra)
                );
            
            palabras.forEach(palabra => {
                frecuencia[palabra] = (frecuencia[palabra] || 0) + 1;
            });
        });
        
        // Convertir a array y ordenar
        return Object.entries(frecuencia)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([palabra, count]) => palabra);
    }
    
    // ========== LIMPIEZA Y MANTENIMIENTO ==========
    
    // Limpiar historial viejo (más de X días)
    limpiarHistorialViejo(dias = 7) {
        const limite = Date.now() - (dias * 24 * 60 * 60 * 1000);
        let eliminados = 0;
        
        for (const [userId, historial] of this.memory.entries()) {
            const nuevoHistorial = historial.filter(msg => {
                const msgTime = new Date(msg.timestamp).getTime();
                return msgTime > limite;
            });
            
            if (nuevoHistorial.length !== historial.length) {
                eliminados += historial.length - nuevoHistorial.length;
                this.memory.set(userId, nuevoHistorial);
                
                // Si el historial quedó vacío, eliminar usuario
                if (nuevoHistorial.length === 0) {
                    this.memory.delete(userId);
                    this.stats.totalUsuarios--;
                }
            }
        }
        
        if (eliminados > 0) {
            console.log(`🧹 Limpiados ${eliminados} mensajes antiguos (más de ${dias} días)`);
        }
        
        return eliminados;
    }
    
    // Limpiar historial de usuario específico
    limpiarHistorialUsuario(userId) {
        if (this.memory.has(userId)) {
            const eliminados = this.memory.get(userId).length;
            this.memory.delete(userId);
            this.stats.totalUsuarios--;
            this.stats.totalMensajes -= eliminados;
            console.log(`🧹 Limpiado historial de ${userId} (${eliminados} mensajes)`);
            return eliminados;
        }
        return 0;
    }
    
    // Optimizar memoria (comprimir mensajes muy antiguos)
    optimizarMemoria() {
        console.log('🔄 Optimizando memoria...');
        
        let comprimidos = 0;
        const ahora = Date.now();
        const limiteCompresion = 24 * 60 * 60 * 1000; // 24 horas
        
        for (const [userId, historial] of this.memory.entries()) {
            if (historial.length > 50) { // Solo comprimir si hay muchos mensajes
                const nuevosMensajes = [];
                const mensajesAntiguos = [];
                
                historial.forEach(msg => {
                    const msgTime = new Date(msg.timestamp).getTime();
                    if (ahora - msgTime < limiteCompresion) {
                        nuevosMensajes.push(msg);
                    } else {
                        mensajesAntiguos.push(msg);
                    }
                });
                
                // Si hay mensajes antiguos, comprimirlos
                if (mensajesAntiguos.length > 10) {
                    const resumen = this.crearResumenCompresion(mensajesAntiguos);
                    nuevosMensajes.push(resumen);
                    comprimidos += mensajesAntiguos.length - 1; // -1 porque dejamos el resumen
                } else {
                    nuevosMensajes.push(...mensajesAntiguos);
                }
                
                this.memory.set(userId, nuevosMensajes);
            }
        }
        
        if (comprimidos > 0) {
            console.log(`📦 Comprimidos ${comprimidos} mensajes antiguos`);
        }
        
        return comprimidos;
    }
    
    // Crear resumen para compresión
    crearResumenCompresion(mensajes) {
        // Ordenar cronológicamente
        mensajes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        const primeros = mensajes.slice(0, 3);
        const ultimos = mensajes.slice(-2);
        
        return {
            id: 'resumen-' + Date.now(),
            rol: 'system',
            contenido: `[Resumen de ${mensajes.length} mensajes antiguos: ${primeros.map(m => m.rol[0] + ':' + m.contenido.substring(0, 30)).join('...')}...]`,
            timestamp: new Date().toISOString(),
            procesado: true,
            esResumen: true,
            totalOriginal: mensajes.length
        };
    }
    
    // ========== ESTADÍSTICAS Y MÉTRICAS ==========
    
    // Obtener estadísticas generales
    obtenerEstadisticas() {
        return {
            maxHistory: this.maxHistory,
            totalUsuarios: this.stats.totalUsuarios,
            totalMensajes: this.stats.totalMensajes,
            memoriaUsada: this.calcularUsoMemoria(),
            promedios: this.calcularPromedios(),
            timestamp: new Date().toISOString()
        };
    }
    
    // Calcular uso de memoria aproximado
    calcularUsoMemoria() {
        let totalChars = 0;
        
        for (const [, historial] of this.memory.entries()) {
            for (const msg of historial) {
                totalChars += JSON.stringify(msg).length;
            }
        }
        
        const kb = totalChars / 1024;
        const mb = kb / 1024;
        
        return {
            caracteres: totalChars,
            kilobytes: kb.toFixed(2),
            megabytes: mb.toFixed(4),
            mensajesPorUsuario: (this.stats.totalMensajes / Math.max(1, this.stats.totalUsuarios)).toFixed(1)
        };
    }
    
    // Calcular promedios
    calcularPromedios() {
        const usuarios = Array.from(this.memory.values());
        
        if (usuarios.length === 0) {
            return {
                mensajesPorUsuario: 0,
                longitudPromedio: 0,
                usuariosActivos: 0
            };
        }
        
        let totalLongitud = 0;
        let totalMensajes = 0;
        let usuariosActivos = 0;
        
        usuarios.forEach(historial => {
            totalMensajes += historial.length;
            
            if (historial.length > 0) {
                usuariosActivos++;
                
                historial.forEach(msg => {
                    totalLongitud += msg.contenido.length;
                });
            }
        });
        
        return {
            mensajesPorUsuario: (totalMensajes / usuarios.length).toFixed(1),
            longitudPromedio: (totalLongitud / totalMensajes).toFixed(0),
            usuariosActivos: usuariosActivos,
            porcentajeActivos: ((usuariosActivos / usuarios.length) * 100).toFixed(1) + '%'
        };
    }
    
    // ========== BACKUP Y RESTAURACIÓN ==========
    
    // Exportar toda la memoria
    exportarMemoria() {
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            maxHistory: this.maxHistory,
            stats: this.stats,
            memory: {}
        };
        
        for (const [userId, historial] of this.memory.entries()) {
            exportData.memory[userId] = historial;
        }
        
        return exportData;
    }
    
    // Importar memoria
    importarMemoria(data) {
        try {
            if (!data.memory || !data.stats) {
                throw new Error('Formato de datos inválido');
            }
            
            // Limpiar memoria actual
            this.memory.clear();
            
            // Importar datos
            for (const [userId, historial] of Object.entries(data.memory)) {
                this.memory.set(userId, historial);
            }
            
            // Actualizar estadísticas
            this.stats = data.stats;
            this.maxHistory = data.maxHistory || 270;
            
            console.log(`✅ Memoria importada: ${this.stats.totalUsuarios} usuarios, ${this.stats.totalMensajes} mensajes`);
            return true;
            
        } catch (error) {
            console.error('❌ Error importando memoria:', error);
            return false;
        }
    }
    
    // ========== UTILIDADES ==========
    
    // Obtener usuarios con más actividad
    obtenerTopUsuarios(limit = 10) {
        const usuarios = [];
        
        for (const [userId, historial] of this.memory.entries()) {
            usuarios.push({
                userId: userId,
                mensajes: historial.length,
                ultimaInteraccion: historial[0]?.timestamp || 'Nunca',
                palabrasTotales: historial.reduce((sum, msg) => sum + msg.contenido.split(' ').length, 0)
            });
        }
        
        // Ordenar por número de mensajes
        usuarios.sort((a, b) => b.mensajes - a.mensajes);
        
        return usuarios.slice(0, limit);
    }
    
    // Verificar si usuario existe
    usuarioExiste(userId) {
        return this.memory.has(userId);
    }
    
    // Obtener información de usuario
    obtenerInfoUsuario(userId) {
        if (!this.memory.has(userId)) {
            return null;
        }
        
        const historial = this.memory.get(userId);
        
        return {
            userId: userId,
            totalMensajes: historial.length,
            primerMensaje: historial[historial.length - 1]?.timestamp || 'N/A',
            ultimoMensaje: historial[0]?.timestamp || 'N/A',
            rolesUsados: [...new Set(historial.map(msg => msg.rol))],
            actividadReciente: historial.slice(0, 5).map(msg => ({
                rol: msg.rol,
                contenido: msg.contenido.substring(0, 50) + '...',
                tiempo: this.calcularTiempoRelativo(msg.timestamp)
            }))
        };
    }
    
    // Calcular tiempo relativo
    calcularTiempoRelativo(timestamp) {
        const ahora = new Date();
        const fecha = new Date(timestamp);
        const diffMs = ahora - fecha;
        
        const segundos = Math.floor(diffMs / 1000);
        const minutos = Math.floor(segundos / 60);
        const horas = Math.floor(minutos / 60);
        const dias = Math.floor(horas / 24);
        
        if (dias > 0) return `hace ${dias} día${dias > 1 ? 's' : ''}`;
        if (horas > 0) return `hace ${horas} hora${horas > 1 ? 's' : ''}`;
        if (minutos > 0) return `hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
        return `hace ${segundos} segundo${segundos > 1 ? 's' : ''}`;
    }
    
    // ========== LIMPIAR TODO ==========
    
    // Limpiar toda la memoria
    limpiarTodaLaMemoria() {
        const totalUsuarios = this.stats.totalUsuarios;
        const totalMensajes = this.stats.totalMensajes;
        
        this.memory.clear();
        this.stats = {
            totalUsuarios: 0,
            totalMensajes: 0,
            llamadasAPI: 0
        };
        
        console.log(`🧹 Memoria limpiada completamente: ${totalUsuarios} usuarios, ${totalMensajes} mensajes eliminados`);
        
        return {
            usuariosEliminados: totalUsuarios,
            mensajesEliminados: totalMensajes
        };
    }
    
    // ========== DIAGNÓSTICO ==========
    
    // Ejecutar diagnóstico del sistema
    ejecutarDiagnostico() {
        console.log('🔍 Ejecutando diagnóstico del sistema de memoria...');
        
        const diagnostico = {
            estadoGeneral: 'OK',
            problemas: [],
            recomendaciones: [],
            estadisticas: this.obtenerEstadisticas(),
            timestamp: new Date().toISOString()
        };
        
        // Verificar memoria excesiva
        const usoMemoria = this.calcularUsoMemoria();
        if (parseFloat(usoMemoria.megabytes) > 10) {
            diagnostico.problemas.push('Uso de memoria alto (>10 MB)');
            diagnostico.recomendaciones.push('Considera limpiar historiales antiguos o reducir maxHistory');
        }
        
        // Verificar usuarios inactivos
        const usuariosInactivos = this.encontrarUsuariosInactivos(30); // 30 días
        if (usuariosInactivos.length > 10) {
            diagnostico.problemas.push(`${usuariosInactivos.length} usuarios inactivos`);
            diagnostico.recomendaciones.push('Ejecuta limpieza automática de usuarios inactivos');
        }
        
        // Verificar historiales muy grandes
        let historialesGrandes = 0;
        for (const [, historial] of this.memory.entries()) {
            if (historial.length > this.maxHistory * 0.8) {
                historialesGrandes++;
            }
        }
        
        if (historialesGrandes > 0) {
            diagnostico.problemas.push(`${historialesGrandes} usuarios cerca del límite de memoria`);
        }
        
        // Actualizar estado general
        if (diagnostico.problemas.length > 0) {
            diagnostico.estadoGeneral = 'ADVERTENCIA';
        }
        
        return diagnostico;
    }
    
    // Encontrar usuarios inactivos
    encontrarUsuariosInactivos(dias = 30) {
        const limite = Date.now() - (dias * 24 * 60 * 60 * 1000);
        const inactivos = [];
        
        for (const [userId, historial] of this.memory.entries()) {
            if (historial.length > 0) {
                const ultimoMensaje = new Date(historial[0].timestamp).getTime();
                if (ultimoMensaje < limite) {
                    inactivos.push({
                        userId: userId,
                        ultimaInteraccion: historial[0].timestamp,
                        diasInactivo: Math.floor((Date.now() - ultimoMensaje) / (24 * 60 * 60 * 1000))
                    });
                }
            }
        }
        
        return inactivos;
    }
}

// ========== EJEMPLO DE USO RÁPIDO ==========
/*
// Crear instancia
const memoryManager = new MemoryManager(270);

// Agregar mensajes
memoryManager.agregarAlHistorial('user123', 'user', 'Hola, ¿cómo estás?');
memoryManager.agregarAlHistorial('user123', 'assistant', '¡Hola! Estoy bien, ¿y tú?');

// Obtener historial
const historial = memoryManager.obtenerHistorialUsuario('user123');

// Obtener estadísticas
const stats = memoryManager.obtenerEstadisticas();

// Limpiar periódicamente
setInterval(() => {
    memoryManager.limpiarHistorialViejo(7); // Limpiar mensajes > 7 días
    memoryManager.optimizarMemoria();
}, 3600000); // Cada hora
*/

export default MemoryManager;
