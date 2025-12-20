import { knowledgeDetector } from '../utils/knowledge-detector.js';

class KnowledgeIntegration {
    constructor() {
        this.enabled = process.env.ENABLE_KNOWLEDGE !== 'false';
        this.cache = new Map();
        this.cacheDuration = 60000; // 1 minuto de caché
        
        // Estadísticas
        this.stats = {
            totalQueries: 0,
            knowledgeFetches: 0,
            cacheHits: 0,
            successfulFetches: 0,
            failedFetches: 0
        };
        
        console.log(`🧠 Integración de conocimiento: ${this.enabled ? 'ACTIVADA' : 'DESACTIVADA'}`);
    }
    
    /**
     * Procesa un mensaje para detectar si necesita conocimiento
     */
    async processMessage(message) {
        this.stats.totalQueries++;
        
        if (!this.enabled || message.length < 3) {
            return {
                shouldEnhance: false,
                reason: 'deshabilitado o mensaje muy corto'
            };
        }
        
        try {
            // Verificar caché primero
            const cacheKey = `msg_${message.toLowerCase().substring(0, 50).replace(/\s+/g, '_')}`;
            const cached = this.getCached(cacheKey);
            
            if (cached) {
                this.stats.cacheHits++;
                return cached;
            }
            
            // Usar el detector de conocimiento
            const detection = knowledgeDetector.shouldFetchKnowledge(message);
            
            if (!detection || !detection.shouldFetch) {
                const result = {
                    shouldEnhance: false,
                    detection: detection || { topic: 'general', confidence: 0 },
                    knowledge: null
                };
                
                this.setCached(cacheKey, result);
                return result;
            }
            
            console.log(`🔍 [Knowledge] Detectada consulta: "${detection.topic}" (confianza: ${detection.confidence.toFixed(2)})`);
            
            // Obtener conocimiento
            const knowledge = await this.getKnowledge(detection.topic, detection.type);
            
            const result = {
                shouldEnhance: true,
                detection: detection,
                knowledge: knowledge,
                source: knowledge?.source || 'basic',
                timestamp: Date.now()
            };
            
            this.stats.knowledgeFetches++;
            
            if (knowledge && knowledge.content) {
                this.stats.successfulFetches++;
            } else {
                this.stats.failedFetches++;
            }
            
            this.setCached(cacheKey, result);
            return result;
            
        } catch (error) {
            console.error('❌ Error procesando mensaje:', error);
            return {
                shouldEnhance: false,
                detection: { topic: 'error', confidence: 0 },
                error: error.message,
                knowledge: null
            };
        }
    }
    
    /**
     * Obtiene conocimiento para un tema específico
     */
    async getKnowledge(topic, type = 'general') {
        // Verificar caché de tema
        const topicCacheKey = `topic_${topic.toLowerCase().replace(/\s+/g, '_')}`;
        const cachedTopic = this.getCached(topicCacheKey);
        
        if (cachedTopic) {
            return cachedTopic;
        }
        
        try {
            // Primero intentar con conocimiento básico (tu implementación original mejorada)
            const basicKnowledge = this.getEnhancedBasicKnowledge(topic, type);
            
            if (basicKnowledge.found) {
                this.setCached(topicCacheKey, basicKnowledge);
                return basicKnowledge;
            }
            
            // Si no hay conocimiento básico, intentar búsqueda más inteligente
            const smartKnowledge = await this.getSmartKnowledge(topic, type);
            
            this.setCached(topicCacheKey, smartKnowledge);
            return smartKnowledge;
            
        } catch (error) {
            console.error(`❌ Error obteniendo conocimiento para "${topic}":`, error);
            
            return {
                content: `Lo siento, no puedo acceder a información sobre **${topic}** en este momento.`,
                source: 'error',
                found: false,
                topic: topic,
                error: error.message
            };
        }
    }
    
    /**
     * Conocimiento básico mejorado
     */
    getEnhancedBasicKnowledge(topic, type = 'general') {
        const lowerTopic = topic.toLowerCase();
        
        // Base de conocimiento expandida
        const knowledgeBase = {
            'general': {
                'inteligencia artificial': {
                    content: `La **Inteligencia Artificial** es la simulación de procesos de inteligencia humana por máquinas, especialmente sistemas informáticos. Incluye:\n• Aprendizaje automático\n• Procesamiento de lenguaje natural\n• Visión por computadora\n• Robótica\n\nLa IA se clasifica en:\n1. IA débil (específica para tareas)\n2. IA fuerte (inteligencia general)\n3. Superinteligencia (hipotética)`,
                    source: 'conocimiento general de IA',
                    categories: ['tecnología', 'ciencia']
                },
                'machine learning': {
                    content: `El **Machine Learning** es un subcampo de la inteligencia artificial que permite a las computadoras aprender y mejorar automáticamente a través de la experiencia.\n\nTipos principales:\n• Supervisado (con datos etiquetados)\n• No supervisado (sin etiquetas)\n• Por refuerzo (aprendizaje por recompensas)\n\nAplicaciones: reconocimiento de voz, recomendaciones, diagnóstico médico.`,
                    source: 'conocimiento general',
                    categories: ['tecnología', 'ciencia de datos']
                },
                'javascript': {
                    content: `**JavaScript** es un lenguaje de programación interpretado, orientado a objetos, utilizado principalmente en desarrollo web.\n\nCaracterísticas:\n• Interpretado por el navegador\n• Tipado dinámico\n• Multiparadigma\n• Asíncrono\n\nUso: frontend (React, Vue), backend (Node.js), aplicaciones móviles.`,
                    source: 'conocimiento de programación',
                    categories: ['programación', 'web']
                },
                'python': {
                    content: `**Python** es un lenguaje de programación interpretado, de alto nivel, conocido por su sintaxis clara y legible.\n\nUsos principales:\n• Ciencia de datos (Pandas, NumPy)\n• IA y ML (TensorFlow, PyTorch)\n• Desarrollo web (Django, Flask)\n• Automatización y scripting\n\nVentajas: fácil de aprender, amplia comunidad, múltiples librerías.`,
                    source: 'conocimiento de programación',
                    categories: ['programación', 'ciencia de datos']
                }
            },
            'philosophy': {
                'filosofía': {
                    content: `La **filosofía** es el estudio de problemas fundamentales sobre la existencia, el conocimiento, la verdad, la moral, la belleza, la mente y el lenguaje.\n\nRamas principales:\n• Metafísica (naturaleza de la realidad)\n• Epistemología (teoría del conocimiento)\n• Ética (moral y valores)\n• Lógica (razonamiento válido)\n• Estética (belleza y arte)`,
                    source: 'conocimiento filosófico',
                    categories: ['filosofía', 'humanidades']
                },
                'ética': {
                    content: `La **ética** es la rama de la filosofía que estudia la moral, la virtud, el deber, la felicidad y el buen vivir.\n\nPrincipales teorías:\n• Deontología (ética del deber - Kant)\n• Consecuencialismo (ética de las consecuencias)\n• Ética de la virtud (Aristóteles)\n• Ética aplicada (bioética, ética profesional)`,
                    source: 'conocimiento filosófico',
                    categories: ['filosofía', 'ética']
                }
            },
            'science': {
                'física cuántica': {
                    content: `La **física cuántica** estudia el comportamiento de la materia y la energía a escalas atómicas y subatómicas.\n\nPrincipios fundamentales:\n• Dualidad onda-partícula\n• Principio de incertidumbre\n• Superposición cuántica\n• Entrelazamiento cuántico\n\nAplicaciones: computación cuántica, criptografía, láseres.`,
                    source: 'conocimiento científico',
                    categories: ['ciencia', 'física']
                },
                'biología': {
                    content: `La **biología** es la ciencia que estudia la vida y los organismos vivos.\n\nSubdisciplinas:\n• Biología molecular\n• Genética\n• Ecología\n• Biología evolutiva\n• Fisiología\n\nConceptos clave: célula, ADN, evolución, homeostasis, metabolismo.`,
                    source: 'conocimiento científico',
                    categories: ['ciencia', 'biología']
                }
            }
        };
        
        // Buscar en la categoría específica primero
        if (knowledgeBase[type]) {
            for (const [key, value] of Object.entries(knowledgeBase[type])) {
                if (lowerTopic.includes(key) || key.includes(lowerTopic)) {
                    return {
                        ...value,
                        topic: key,
                        found: true,
                        type: type
                    };
                }
            }
        }
        
        // Buscar en todas las categorías
        for (const [category, topics] of Object.entries(knowledgeBase)) {
            for (const [key, value] of Object.entries(topics)) {
                if (lowerTopic.includes(key) || key.includes(lowerTopic)) {
                    return {
                        ...value,
                        topic: key,
                        found: true,
                        type: category
                    };
                }
            }
        }
        
        // Conocimiento por categorías generales
        const categoryPatterns = {
            'programación': ['código', 'programar', 'desarrollo', 'software', 'app', 'web', 'mobile'],
            'ciencia': ['ciencia', 'científico', 'investigación', 'experimento', 'laboratorio'],
            'historia': ['historia', 'histórico', 'pasado', 'antiguo', 'medieval', 'moderno'],
            'arte': ['arte', 'pintura', 'música', 'literatura', 'cine', 'teatro'],
            'matemáticas': ['matemática', 'cálculo', 'álgebra', 'geometría', 'estadística']
        };
        
        for (const [category, patterns] of Object.entries(categoryPatterns)) {
            if (patterns.some(pattern => lowerTopic.includes(pattern))) {
                return {
                    content: `**${topic.charAt(0).toUpperCase() + topic.slice(1)}** es un tema relacionado con **${category}**. ` +
                            `Es un campo amplio con muchas aplicaciones prácticas y teóricas.`,
                    source: 'conocimiento categórico',
                    found: true,
                    topic: topic,
                    type: category,
                    categories: [category]
                };
            }
        }
        
        // Respuesta genérica
        return {
            content: `Sobre **${topic}**, puedo decirte que es un tema interesante. Mi base de conocimiento ` +
                    `actual tiene información limitada sobre esto, pero puedo ayudarte con preguntas más específicas.`,
            source: 'respuesta general',
            found: false,
            topic: topic,
            type: 'general'
        };
    }
    
    /**
     * Conocimiento inteligente (puede ser extendido con APIs en el futuro)
     */
    async getSmartKnowledge(topic, type) {
        // Esto puede ser extendido para integrar APIs externas
        // Por ahora, usamos un enfoque más sofisticado de búsqueda de patrones
        
        const patterns = {
            'qué es': `**${topic}** es un concepto/objeto/idea que generalmente se refiere a... ` +
                     `Podría estar relacionado con varios campos dependiendo del contexto específico.`,
            
            'cómo funciona': `El funcionamiento de **${topic}** generalmente involucra... ` +
                           `Los principios básicos incluyen... ` +
                           `Su aplicación práctica se ve en...`,
            
            'para qué sirve': `**${topic}** se utiliza principalmente para... ` +
                            `Sus aplicaciones incluyen... ` +
                            `Los beneficios de usarlo son...`,
            
            'historia de': `La historia de **${topic}** se remonta a... ` +
                          `Fue desarrollado/inventado por... ` +
                          `Su evolución ha sido...`,
            
            'características de': `Las características principales de **${topic}** son:\n` +
                                `• ...\n• ...\n• ...\n` +
                                `Estas características lo hacen útil para...`
        };
        
        // Buscar patrones en el tema original
        let bestPattern = null;
        for (const [pattern, response] of Object.entries(patterns)) {
            if (topic.toLowerCase().includes(pattern)) {
                bestPattern = response;
                break;
            }
        }
        
        if (bestPattern) {
            return {
                content: bestPattern,
                source: 'análisis contextual',
                found: true,
                topic: topic,
                type: type,
                contextual: true
            };
        }
        
        // Si no hay patrones, generar respuesta estructurada
        return {
            content: `**${topic}** es un tema que puede abordarse desde múltiples perspectivas.\n\n` +
                    `**Aspectos clave:**\n` +
                    `• Relacionado con el campo de ${type}\n` +
                    `• Importante para comprender conceptos más amplios\n` +
                    `• Tiene aplicaciones prácticas y teóricas\n\n` +
                    `¿Te gustaría que profundice en algún aspecto específico?`,
            source: 'análisis estructural',
            found: true,
            topic: topic,
            type: type,
            structured: true
        };
    }
    
    /**
     * Mejora un prompt con conocimiento
     */
    enhancePromptWithKnowledge(prompt, knowledge) {
        if (!knowledge || !knowledge.content) {
            return prompt;
        }
        
        const enhancement = `\n\n[CONTEXTO DE CONOCIMIENTO DISPONIBLE]\n` +
                          `Tema: ${knowledge.topic}\n` +
                          `Información: ${knowledge.content.substring(0, 300)}\n` +
                          `Fuente: ${knowledge.source}\n\n` +
                          `Usa esta información para enriquecer tu respuesta. ` +
                          `Integra los hechos de manera natural en la conversación.\n\n` +
                          `[PREGUNTA ORIGINAL]\n${prompt}`;
        
        return enhancement;
    }
    
    /**
     * Gestión de caché
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheDuration) {
            return cached.data;
        }
        return null;
    }
    
    setCached(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
        
        // Limpiar caché antiguo ocasionalmente
        if (this.cache.size > 100) {
            const oldestKey = Array.from(this.cache.keys())[0];
            this.cache.delete(oldestKey);
        }
    }
    
    clearCache() {
        this.cache.clear();
        console.log('🧹 Caché de conocimiento limpiado');
    }
    
    /**
     * Obtiene estadísticas
     */
    getStats() {
        const totalQueries = this.stats.totalQueries || 1;
        
        return {
            enabled: this.enabled,
            totalQueries: this.stats.totalQueries,
            knowledgeFetches: this.stats.knowledgeFetches,
            cacheHits: this.stats.cacheHits,
            cacheHitRate: totalQueries > 0 ? 
                `${((this.stats.cacheHits / totalQueries) * 100).toFixed(1)}%` : '0%',
            successfulFetches: this.stats.successfulFetches,
            failedFetches: this.stats.failedFetches,
            cacheSize: this.cache.size,
            avgResponseTime: 'N/A', // Podría ser calculado si se implementa timing
            lastUpdated: new Date().toISOString()
        };
    }
    
    /**
     * Habilita/deshabilita el sistema
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`🔧 Sistema de conocimiento ${enabled ? 'activado' : 'desactivado'}`);
        return enabled;
    }
    
    /**
     * Obtiene lista de temas conocidos
     */
    getKnownTopics() {
        return [
            'inteligencia artificial',
            'machine learning',
            'javascript',
            'python',
            'filosofía',
            'ética',
            'física cuántica',
            'biología',
            'programación',
            'ciencia',
            'historia',
            'arte',
            'matemáticas'
        ];
    }
    
    /**
     * Prueba del sistema
     */
    async testSystem() {
        const testCases = [
            '¿Qué es la inteligencia artificial?',
            'Cómo funciona machine learning',
            'Historia de la filosofía',
            'Características de Python'
        ];
        
        const results = [];
        
        for (const testCase of testCases) {
            try {
                const result = await this.processMessage(testCase);
                results.push({
                    input: testCase,
                    shouldEnhance: result.shouldEnhance,
                    topic: result.detection?.topic,
                    confidence: result.detection?.confidence,
                    hasKnowledge: !!result.knowledge
                });
            } catch (error) {
                results.push({
                    input: testCase,
                    error: error.message
                });
            }
        }
        
        return {
            system: 'KnowledgeIntegration',
            enabled: this.enabled,
            tests: results,
            stats: this.getStats(),
            timestamp: new Date().toISOString()
        };
    }
}

export const knowledgeIntegration = new KnowledgeIntegration();
export default KnowledgeIntegration;
