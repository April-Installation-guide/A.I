// MemoryManager.js
export class MemoryManager {
    constructor(maxHistory = 270) {
        this.conversationMemory = new Map();
        this.MAX_HISTORY = maxHistory;
        console.log('🧠 MemoryManager inicializado (max:', maxHistory, 'mensajes)');
    }

    obtenerHistorialUsuario(userId) {
        if (!this.conversationMemory.has(userId)) {
            this.conversationMemory.set(userId, []);
        }
        return this.conversationMemory.get(userId);
    }

    agregarAlHistorial(userId, rol, contenido) {
        const historial = this.obtenerHistorialUsuario(userId);
        historial.push({ rol, contenido, timestamp: Date.now() });
        
        if (historial.length > this.MAX_HISTORY) {
            historial.splice(0, historial.length - this.MAX_HISTORY);
        }
        return historial.length;
    }

    obtenerEstadisticas() {
        const totalUsuarios = this.conversationMemory.size;
        const totalMensajes = Array.from(this.conversationMemory.values())
            .reduce((sum, hist) => sum + hist.length, 0);
        
        return { 
            totalUsuarios, 
            totalMensajes,
            maxHistory: this.MAX_HISTORY 
        };
    }

    limpiarMemoriaAntigua(dias = 7) {
        const ahora = Date.now();
        const limite = dias * 24 * 60 * 60 * 1000;
        let eliminados = 0;
        
        for (const [userId, historial] of this.conversationMemory.entries()) {
            const historialReciente = historial.filter(
                msg => (ahora - msg.timestamp) < limite
            );
            
            if (historialReciente.length === 0) {
                this.conversationMemory.delete(userId);
                eliminados++;
            } else if (historialReciente.length !== historial.length) {
                this.conversationMemory.set(userId, historialReciente);
                eliminados += (historial.length - historialReciente.length);
            }
        }
        
        if (eliminados > 0) {
            console.log(`🧹 Limpiados ${eliminados} mensajes antiguos`);
        }
        return eliminados;
    }
}
