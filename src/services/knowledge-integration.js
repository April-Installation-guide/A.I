import { knowledgeDetector } from '../utils/knowledge-detector.js';
import { knowledgeAPIs } from '../api/knowledge-apis.js';

class KnowledgeIntegration {
    constructor() {
        this.cache = new Map();
        this.maxRetries = 2;
        this.timeout = 8000; // 8 segundos máximo por búsqueda
        this.enabled = true;
        
        // Estadísticas
        this.stats = {
            totalQueries: 0,
            knowledgeFetches: 0,
            cacheHits: 0,
            successfulFetches: 0,
            failedFetches: 0,
            responseTimes: []
        };
    }
    
    /**
     * Procesa un mensaje y decide si buscar conocimiento
     */
    async processMessage(message, userContext = {}) {
        this.stats.totalQueries++;
        
        // Verificar si está habilitado
        if (!this.enabled) {
            return { shouldEnhance: false };
        }
        
        // Detectar si necesita conocimiento
        const detection = knowledgeDetector.shouldFetchKnowledge(message);
        
        if (!detection.shouldFetch || !detection.topic) {
            return { shouldEnhance: false };
        }
        
        console.log(`🧠 [KNOWLEDGE] Detected knowledge query: "${detection.topic}" (type: ${detection.type}, confidence: ${detection.confidence})`);
        
        // Verificar caché
        const cacheKey = `${detection.type}_${detection.topic.toLowerCase()}`;
        const cachedResult = this.getFromCache(cacheKey);
        
        if (cachedResult) {
            this.stats.cacheHits++;
            console.log(`🧠 [KNOWLEDGE] Cache hit for: ${detection.topic}`);
            return {
                shouldEnhance: true,
                knowledge: cachedResult,
                source: 'cache',
                detection: detection
            };
        }
        
        // Determinar qué APIs usar
        const apisToUse = knowledgeDetector.determineAPI(detection.type, detection.topic);
        
        // Buscar conocimiento en paralelo con timeout
        const startTime = Date.now();
        const knowledge = await this.fetchKnowledgeWithTimeout(
            detection.topic, 
            detection.type, 
            apisToUse
        );
        const elapsedTime = Date.now() - startTime;
        
        this.stats.responseTimes.push(elapsedTime);
        
        if (knowledge) {
            this.stats.successfulFetches++;
            this.stats.knowledgeFetches++;
            
            // Guardar en caché
            this.saveToCache(cacheKey, knowledge, 3600000); // 1 hora
            
            console.log(`🧠 [KNOWLEDGE] Found knowledge for: ${detection.topic} (${elapsedTime}ms)`);
            
            return {
                shouldEnhance: true,
                knowledge: knowledge,
                source: 'api',
                detection: detection,
                searchTime: elapsedTime
            };
        } else {
            this.stats.failedFetches++;
            console.log(`🧠 [KNOWLEDGE] No knowledge found for: ${detection.topic}`);
            
            return { shouldEnhance: false };
        }
    }
    
    /**
     * Busca conocimiento con timeout y reintentos
     */
    async fetchKnowledgeWithTimeout(topic, type, apisToUse) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Knowledge search timeout')), this.timeout);
        });
        
        const searchPromise = this.fetchKnowledge(topic, type, apisToUse);
        
        try {
            return await Promise.race([searchPromise, timeoutPromise]);
        } catch (error) {
            console.error(`🧠 [KNOWLEDGE] Error fetching knowledge:`, error.message);
            return null;
        }
    }
    
    /**
     * Busca conocimiento usando múltiples APIs
     */
    async fetchKnowledge(topic, type, apisToUse) {
        const results = {};
        let primaryResult = null;
        
        // Intentar cada API en orden de prioridad
        for (const api of apisToUse) {
            try {
                let result = null;
                
                switch(api.name) {
                    case 'wikipedia':
                        result = await knowledgeAPIs.searchWikipedia(topic, 'es', true);
                        break;
                        
                    case 'dictionary':
                        result = await knowledgeAPIs.getWordDefinition(topic, 'es');
                        break;
                        
                    case 'books':
                        result = await knowledgeAPIs.searchBooks(topic, 1);
                        break;
                        
                    case 'philosophy':
                        result = await knowledgeAPIs.getPhilosopherInfo(topic);
                        break;
                        
                    case 'historical':
                        result = await knowledgeAPIs.searchHistoricalEvent(topic);
                        break;
                        
                    case 'programming':
                        result = await knowledgeAPIs.searchProgrammingDocs(topic);
                        break;
                }
                
                if (result && result.success) {
                    results[api.name] = result.data;
                    
                    // Si es la API principal y tiene buenos datos, usarla
                    if (api.priority === 1 && this.isGoodResult(result.data, type)) {
                        primaryResult = {
                            source: api.name,
                            data: result.data,
                            type: type,
                            timestamp: new Date().toISOString()
                        };
                        break; // Salir del bloop si encontramos buen resultado principal
                    }
                }
            } catch (error) {
                console.error(`🧠 [KNOWLEDGE] Error with ${api.name}:`, error.message);
                // Continuar con la siguiente API
            }
        }
        
        // Si no hay resultado principal, usar el mejor disponible
        if (!primaryResult && Object.keys(results).length > 0) {
            const bestApi = Object.keys(results)[0]; // Primera que funcionó
            primaryResult = {
                source: bestApi,
                data: results[bestApi],
                type: type,
                timestamp: new Date().toISOString(),
                fallback: true
            };
        }
        
        // Combinar resultados si hay múltiples fuentes
        if (primaryResult && Object.keys(results).length > 1) {
            primaryResult.additionalSources = results;
        }
        
        return primaryResult;
    }
    
    /**
     * Evalúa si un resultado es bueno para el tipo de consulta
     */
    isGoodResult(data, type) {
        if (!data) return false;
        
        switch(type) {
            case 'definicion':
                return data.definiciones && data.definiciones.length > 0;
                
            case 'historia':
                return data.descripcion && data.descripcion.length > 100;
                
            case 'biografia':
                return data.biografia && data.biografia.length > 150;
                
            case 'concepto':
                return data.descripcion && data.descripcion.length > 100;
                
            default:
                return data.extracto && data.extracto.length > 50;
        }
    }
    
    /**
     * Formatea el conocimiento para incluirlo en el contexto de Groq
     */
    formatKnowledgeForPrompt(knowledgeResult) {
        if (!knowledgeResult) return '';
        
        const { source, data, type } = knowledgeResult;
        let formattedText = '';
        
        switch(source) {
            case 'wikipedia':
                formattedText = `Información de Wikipedia sobre "${data.titulo}":\n${data.extracto}`;
                if (data.descripcion) {
                    formattedText += `\n\nDescripción: ${data.descripcion}`;
                }
                break;
                
            case 'dictionary':
                formattedText = `Definición de "${data.palabra}":\n`;
                data.definiciones.forEach((def, idx) => {
                    formattedText += `${idx + 1}. [${def.categoria}] ${def.definicion}\n`;
                    if (def.ejemplo) {
                        formattedText += `   Ejemplo: "${def.ejemplo}"\n`;
                    }
                });
                break;
                
            case 'books':
                if (data.libros && data.libros.length > 0) {
                    const libro = data.libros[0];
                    formattedText = `Libro encontrado: "${libro.titulo}"\n`;
                    formattedText += `Autor: ${libro.autor}\n`;
                    formattedText += `Año: ${libro.año}\n`;
                    if (libro.descripcion) {
                        formattedText += `Resumen: ${libro.descripcion.substring(0, 300)}...\n`;
                    }
                }
                break;
                
            case 'philosophy':
                formattedText = `Filósofo: ${data.nombre}\n`;
                formattedText += `Escuela: ${data.escuela}\n`;
                formattedText += `Período: ${data.periodo}\n`;
                formattedText += `Biografía: ${data.biografia.substring(0, 400)}...`;
                break;
                
            case 'historical':
                formattedText = `Evento histórico: ${data.evento}\n`;
                formattedText += `Fecha: ${data.fecha}\n`;
                formattedText += `Descripción: ${data.descripcion.substring(0, 400)}...`;
                break;
                
            case 'programming':
                if (data.resultados && data.resultados.length > 0) {
                    const doc = data.resultados[0];
                    formattedText = `Documentación técnica:\n${doc.titulo}\n`;
                    formattedText += `${doc.resumen.substring(0, 400)}...`;
                }
                break;
        }
        
        // Añadir fuente
        formattedText += `\n\n[Fuente: ${source.toUpperCase()}, Tipo: ${type}]`;
        
        return formattedText.substring(0, 1500); // Limitar longitud
    }
    
    /**
     * Crea un prompt mejorado con conocimiento
     */
    enhancePromptWithKnowledge(originalPrompt, knowledgeResult) {
        if (!knowledgeResult) return originalPrompt;
        
        const knowledgeText = this.formatKnowledgeForPrompt(knowledgeResult);
        
        return `INFORMACIÓN DE REFERENCIA (usa esta información para responder con precisión):
${knowledgeText}

CONTEXTO ORIGINAL:
${originalPrompt}

INSTRUCCIONES:
1. Utiliza la información de referencia proporcionada para enriquecer tu respuesta
2. Si la información de referencia no es suficiente o no es relevante, usa tu conocimiento general
3. Sé preciso y cita la fuente cuando sea apropiado
4. Mantén un tono natural y conversacional

RESPUESTA:`;
    }
    
    /**
     * Manejo de caché
     */
    getFromCache(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }
    
    saveToCache(key, data, ttl = 3600000) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttl
        });
        
        // Limpieza periódica
        if (this.cache.size > 1000) {
            const now = Date.now();
            for (const [cacheKey, item] of this.cache.entries()) {
                if (now > item.expiry) {
                    this.cache.delete(cacheKey);
                }
            }
        }
    }
    
    /**
     * Obtiene estadísticas
     */
    getStats() {
        const avgResponseTime = this.stats.responseTimes.length > 0
            ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
            : 0;
            
        const cacheHitRate = this.stats.knowledgeFetches > 0
            ? (this.stats.cacheHits / this.stats.knowledgeFetches) * 100
            : 0;
            
        return {
            ...this.stats,
            avgResponseTime: Math.round(avgResponseTime),
            cacheHitRate: cacheHitRate.toFixed(1) + '%',
            cacheSize: this.cache.size,
            enabled: this.enabled
        };
    }
    
    /**
     * Habilita/deshabilita la integración
     */
    setEnabled(status) {
        this.enabled = status;
        return this.enabled;
    }
}

export const knowledgeIntegration = new KnowledgeIntegration();
