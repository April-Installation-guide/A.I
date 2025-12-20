class KnowledgeDetector {
    constructor() {
        // Patrones mejorados de preguntas
        this.patterns = [
            // Qué es... (mejorado)
            { 
                regex: /^(qué|que)\s+(es|son|significa|se\s+entiende\s+por)\s+(.+)/i, 
                type: 'definicion', 
                group: 3,
                confidence: 0.9
            },
            { 
                regex: /^defin(e|ición|ir|amos)\s+(.+)/i, 
                type: 'definicion', 
                group: 2,
                confidence: 0.85
            },
            { 
                regex: /^(el\s+)?significado\s+(de|del|de la)?\s*(.+)/i, 
                type: 'definicion', 
                group: 3,
                confidence: 0.8
            },
            
            // Quién es... (mejorado)
            { 
                regex: /^(quién|quien)\s+(es|fue|era|fueron|creó|inventó)\s+(.+)/i, 
                type: 'biografia', 
                group: 3,
                confidence: 0.9
            },
            { 
                regex: /^biografía\s+(de|del|de la|de los|de las)?\s*(.+)/i, 
                type: 'biografia', 
                group: 2,
                confidence: 0.85
            },
            
            // Historia... (mejorado)
            { 
                regex: /^historia\s+(de|del|de la|de los|de las)?\s*(.+)/i, 
                type: 'historia', 
                group: 2,
                confidence: 0.8
            },
            { 
                regex: /^(origen|evolución)\s+(de|del|de la)?\s*(.+)/i, 
                type: 'historia', 
                group: 3,
                confidence: 0.75
            },
            
            // Cómo funciona... (mejorado)
            { 
                regex: /^(cómo|como)\s+(funciona|se\s+hace|se\s+usa|trabaja)\s+(.+)/i, 
                type: 'concepto', 
                group: 3,
                confidence: 0.85
            },
            { 
                regex: /^explica\s+(me\s+)?(cómo|como\s+funciona\s+)?(.+)/i, 
                type: 'concepto', 
                group: 3,
                confidence: 0.8
            },
            
            // Información sobre... (mejorado)
            { 
                regex: /^(información|datos|habla|cuéntame|dime|sabes)\s+(sobre|de|acerca de|acerca)\s+(.+)/i, 
                type: 'general', 
                group: 3,
                confidence: 0.7
            },
            
            // Características...
            { 
                regex: /^(características|propiedades|elementos|partes)\s+(de|del|de la)?\s*(.+)/i, 
                type: 'caracteristicas', 
                group: 3,
                confidence: 0.75
            },
            
            // Dónde...
            { 
                regex: /^(dónde|donde)\s+(está|se\s+encuentra|se\s+situa)\s+(.+)/i, 
                type: 'ubicacion', 
                group: 3,
                confidence: 0.7
            },
            
            // Cuándo...
            { 
                regex: /^(cuándo|cuando)\s+(fue|ocurrió|sucedió|se\s+creó)\s+(.+)/i, 
                type: 'temporal', 
                group: 3,
                confidence: 0.7
            },
            
            // Por qué...
            { 
                regex: /^(por\s+qué|porque|por\s+qué\s+es)\s+(.+)/i, 
                type: 'causa', 
                group: 2,
                confidence: 0.8
            },
            
            // Preguntas complejas
            { 
                regex: /^(cuál|cuáles)\s+(es|son|fue|fueron)\s+(el\s+)?(.+)/i, 
                type: 'pregunta', 
                group: 4,
                confidence: 0.7
            }
        ];
        
        // Palabras clave mejoradas
        this.keywords = new Set([
            // Palabras de pregunta
            'qué', 'que', 'quién', 'quien', 'cuál', 'cual', 'cuáles', 'cuales',
            'cómo', 'como', 'cuándo', 'cuando', 'dónde', 'donde', 'por qué', 'porque',
            
            // Palabras de conocimiento
            'definición', 'definir', 'definimos', 'significado', 'concepto',
            'historia', 'origen', 'evolución', 'desarrollo',
            'biografía', 'vida', 'obra', 'logros',
            'explica', 'explicación', 'explicar', 'entender', 'comprender',
            'información', 'datos', 'hechos', 'estadísticas', 'cifras',
            'características', 'propiedades', 'atributos', 'cualidades',
            'elementos', 'componentes', 'partes', 'secciones',
            'funciona', 'funcionamiento', 'mecanismo', 'proceso',
            'tipos', 'clases', 'categorías', 'variedades',
            'ejemplos', 'ejemplo', 'casos', 'aplicaciones',
            
            // Palabras técnicas
            'tecnología', 'ciencia', 'matemáticas', 'física', 'química',
            'biología', 'programación', 'informática', 'ingeniería',
            'arte', 'literatura', 'filosofía', 'psicología', 'sociología'
        ]);
        
        // Patrones de conversación normal (no buscar conocimiento)
        this.conversationPatterns = [
            /^hola.*/i,
            /^holi.*/i,
            /^(hey|hi|hello).*/i,
            /^(qué\s+tal|cómo\s+estás|cómo\s+andas).*/i,
            /^(buenos\s+días|buenas\s+tardes|buenas\s+noches).*/i,
            /^(adiós|chao|bye|nos\s+vemos|hasta\s+luego).*/i,
            /^(gracias|thank|merci|obligado|obligada).*/i,
            /^(de\s+nada|por\s+nada|no\s+hay\s+problema).*/i,
            /^(por\s+favor|please|favor).*/i,
            /^(qué\s+pasa|qué\s+onda|qué\s+hubo).*/i,
            /^(estoy|me\s+siento)\s+(bien|mal|feliz|triste|enojad[oa]).*/i,
            /^(te\s+amo|te\s+quiero|me\s+gustas).*/i,
            /^(eres|soy)\s+(.*)/i,
            /^(quiero|necesito|deseo)\s+(.*)/i,
            /^(vamos|vámonos|vayamos)\s+(.*)/i,
            /^(oye|oiga|escucha).*/i,
            /^(perdón|disculpa|lo\s+siento).*/i,
            /^(feliz\s+cumpleaños|felicidades|felicitaciones).*/i,
            /^(sí|no|tal\s+vez|quizás|puede\s+ser).*/i,
            /^(está\s+bien|ok|okey|vale|de\s+acuerdo).*/i
        ];
        
        // Palabras de emoción/sentimiento
        this.emotionWords = new Set([
            'feliz', 'triste', 'enojado', 'enojada', 'emocionado', 'emocionada',
            'cansado', 'cansada', 'aburrido', 'aburrida', 'nervioso', 'nerviosa',
            'asustado', 'asustada', 'preocupado', 'preocupada', 'esperanzado', 'esperanzada',
            'amor', 'odio', 'miedo', 'alegría', 'tristeza', 'ira', 'calma'
        ]);
        
        // Historial de consultas para aprendizaje
        this.queryHistory = [];
        this.maxHistorySize = 100;
        
        // Categorías detectadas frecuentemente
        this.frequentCategories = new Map();
        
        console.log('🧠 KnowledgeDetector inicializado');
    }
    
    /**
     * Detecta si es una pregunta de conocimiento
     */
    shouldFetchKnowledge(message) {
        const text = message.toLowerCase().trim();
        
        // Verificar longitud mínima
        if (text.length < 3) {
            return { shouldFetch: false, reason: 'mensaje muy corto' };
        }
        
        // Verificar si es conversación normal
        if (this.isConversation(text)) {
            return { 
                shouldFetch: false, 
                reason: 'conversación normal',
                confidence: 0.1 
            };
        }
        
        // Calcular confianza inicial
        let baseConfidence = this.calculateBaseConfidence(text);
        
        // Verificar patrones específicos
        let bestMatch = null;
        for (const pattern of this.patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                const topic = this.extractTopic(match[pattern.group], pattern.type);
                if (topic && topic.length > 2) {
                    const confidence = Math.min(0.95, baseConfidence + pattern.confidence);
                    bestMatch = {
                        shouldFetch: true,
                        confidence: confidence,
                        topic: topic,
                        type: pattern.type,
                        match: match[0],
                        pattern: pattern.regex.source
                    };
                    break; // Usar el primer patrón que coincida
                }
            }
        }
        
        // Si no hay patrón específico, verificar palabras clave
        if (!bestMatch) {
            if (this.hasKnowledgeKeywords(text)) {
                const topic = this.extractTopic(text, 'general');
                if (topic && topic.length > 2) {
                    const confidence = Math.min(0.7, baseConfidence + 0.3);
                    bestMatch = {
                        shouldFetch: true,
                        confidence: confidence,
                        topic: topic,
                        type: 'general',
                        reason: 'palabras clave detectadas'
                    };
                }
            }
        }
        
        // Verificar si es una pregunta (termina con ?)
        if (!bestMatch && text.includes('?')) {
            const topic = this.extractTopic(text.replace(/\?/g, ''), 'pregunta');
            if (topic && topic.length > 2) {
                const confidence = Math.min(0.6, baseConfidence + 0.2);
                bestMatch = {
                    shouldFetch: true,
                    confidence: confidence,
                    topic: topic,
                    type: 'pregunta',
                    reason: 'formulación de pregunta'
                };
            }
        }
        
        // Verificar si contiene palabras técnicas/complejas
        if (!bestMatch && this.hasComplexWords(text)) {
            const topic = this.extractTopic(text, 'detalle');
            const confidence = Math.min(0.5, baseConfidence + 0.1);
            bestMatch = {
                shouldFetch: true,
                confidence: confidence,
                topic: topic,
                type: 'detalle',
                reason: 'vocabulario técnico/complejo'
            };
        }
        
        // Registrar en historial si es consulta de conocimiento
        if (bestMatch) {
            this.addToHistory(text, bestMatch);
            
            // Actualizar categorías frecuentes
            this.updateFrequentCategories(bestMatch.type);
            
            return bestMatch;
        }
        
        return { 
            shouldFetch: false, 
            confidence: baseConfidence,
            reason: 'no se detectó necesidad de conocimiento'
        };
    }
    
    /**
     * Calcula confianza base según características del mensaje
     */
    calculateBaseConfidence(text) {
        let confidence = 0.3; // Confianza base
        
        // Longitud del mensaje (mensajes más largos tienden a necesitar más información)
        const lengthScore = Math.min(0.3, text.length / 100);
        confidence += lengthScore;
        
        // Presencia de signos de interrogación
        const questionMarks = (text.match(/\?/g) || []).length;
        confidence += Math.min(0.2, questionMarks * 0.1);
        
        // Palabras por oración (oraciones más complejas)
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgWordsPerSentence = sentences.length > 0 
            ? text.split(/\s+/).length / sentences.length 
            : 1;
        
        if (avgWordsPerSentence > 7) {
            confidence += 0.15;
        }
        
        // Presencia de números (indica datos específicos)
        const hasNumbers = /\d/.test(text);
        if (hasNumbers) confidence += 0.1;
        
        // Presencia de mayúsculas (nombres propios, acrónimos)
        const hasCapitalLetters = /[A-ZÁÉÍÓÚÑ]/.test(text);
        if (hasCapitalLetters) confidence += 0.05;
        
        // Presencia de emoción (reduce confianza de conocimiento)
        const emotionScore = this.hasEmotionWords(text);
        if (emotionScore > 0) confidence -= Math.min(0.2, emotionScore * 0.1);
        
        return Math.max(0.1, Math.min(0.9, confidence));
    }
    
    /**
     * Extrae el tema principal mejorado
     */
    extractTopic(text, type = 'general') {
        // Limpiar el texto
        let cleaned = text
            .replace(/[?¿!¡.,;:]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Para definiciones, remover palabras comunes específicas
        const commonPhrases = {
            definicion: ['definición de', 'definir', 'significado de', 'qué es', 'qué son'],
            biografia: ['biografía de', 'quién es', 'quién fue', 'vida de'],
            historia: ['historia de', 'origen de', 'evolución de'],
            concepto: ['cómo funciona', 'explica', 'funcionamiento de'],
            general: ['información sobre', 'datos de', 'habla de', 'cuéntame de', 'dime de']
        };
        
        if (commonPhrases[type]) {
            commonPhrases[type].forEach(phrase => {
                cleaned = cleaned.replace(new RegExp(`^${phrase}\\s+`, 'i'), '');
            });
        }
        
        // Palabras comunes a remover
        const commonWords = new Set([
            'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
            'de', 'del', 'al', 'a', 'con', 'por', 'para', 'en', 'sobre',
            'es', 'son', 'fue', 'era', 'ser', 'estar', 'tener', 'haber',
            'y', 'o', 'ni', 'pero', 'mas', 'aunque', 'sin', 'bajo',
            'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
            'me', 'te', 'se', 'nos', 'os', 'le', 'les', 'lo', 'la',
            'mi', 'tu', 'su', 'nuestro', 'nuestra', 'vuestro', 'vuestra',
            'mío', 'tuyo', 'suyo', 'mía', 'tuya', 'suya'
        ]);
        
        // Dividir en palabras y filtrar
        const words = cleaned.split(/\s+/);
        const filtered = words.filter(word => 
            word.length > 2 && 
            !commonWords.has(word.toLowerCase()) &&
            !this.emotionWords.has(word.toLowerCase())
        );
        
        // Si no hay palabras después de filtrar, usar el texto original
        if (filtered.length === 0) {
            return cleaned.substring(0, 50);
        }
        
        // Estrategias de extracción según tipo
        let topic;
        switch(type) {
            case 'definicion':
            case 'biografia':
                // Tomar las últimas 1-2 palabras (el sujeto)
                topic = filtered.slice(-Math.min(2, filtered.length)).join(' ');
                break;
                
            case 'historia':
            case 'concepto':
                // Tomar 2-3 palabras que mejor representen el tema
                topic = filtered.slice(-Math.min(3, filtered.length)).join(' ');
                break;
                
            default:
                // Combinar palabras significativas
                const meaningfulWords = filtered.filter(word => 
                    word.length > 3 && 
                    !this.isCommonWord(word)
                );
                
                if (meaningfulWords.length > 0) {
                    topic = meaningfulWords.slice(0, 3).join(' ');
                } else {
                    topic = filtered.slice(0, 3).join(' ');
                }
        }
        
        // Capitalizar primera letra
        if (topic.length > 0) {
            topic = topic.charAt(0).toUpperCase() + topic.slice(1);
        }
        
        return topic || cleaned.substring(0, 50);
    }
    
    /**
     * Verifica si es conversación normal
     */
    isConversation(text) {
        // Verificar patrones de conversación
        for (const pattern of this.conversationPatterns) {
            if (pattern.test(text)) {
                return true;
            }
        }
        
        // Verificar si es muy corto para ser consulta de conocimiento
        if (text.length < 10 && !text.includes('?')) {
            return true;
        }
        
        // Verificar si es principalmente emoción
        const emotionScore = this.hasEmotionWords(text);
        if (emotionScore > 2) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Verifica palabras clave de conocimiento mejorado
     */
    hasKnowledgeKeywords(text) {
        const words = text.toLowerCase().split(/\s+/);
        
        // Contar palabras clave
        let keywordCount = 0;
        for (const word of words) {
            if (this.keywords.has(word)) {
                keywordCount++;
                
                // Si hay múltiples palabras clave, es más probable que sea consulta
                if (keywordCount >= 2) {
                    return true;
                }
            }
        }
        
        // Verificar frases de dos palabras
        const phrases = [
            'qué es', 'quién es', 'cómo funciona', 'por qué',
            'significado de', 'definición de', 'historia de',
            'información sobre', 'datos de', 'explica cómo'
        ];
        
        for (const phrase of phrases) {
            if (text.includes(phrase)) {
                return true;
            }
        }
        
        return keywordCount > 0;
    }
    
    /**
     * Verifica palabras complejas/técnicas
     */
    hasComplexWords(text) {
        const complexWordPatterns = [
            /[A-Z]{3,}/, // Acrónimos
            /\b(?:[A-Z][a-z]*){2,}\b/, // Nombres propios compuestos
            /\b\w{8,}\b/, // Palabras largas
            /\b(?:tecnología|ciencia|matemática|física|química|biología|programación)\b/i
        ];
        
        return complexWordPatterns.some(pattern => pattern.test(text));
    }
    
    /**
     * Verifica palabras de emoción
     */
    hasEmotionWords(text) {
        const words = text.toLowerCase().split(/\s+/);
        return words.filter(word => this.emotionWords.has(word)).length;
    }
    
    /**
     * Verifica si es palabra común
     */
    isCommonWord(word) {
        const commonWords = new Set([
            'cosa', 'algo', 'nada', 'todo', 'poco', 'mucho',
            'gran', 'grande', 'pequeño', 'bueno', 'malo',
            'nuevo', 'viejo', 'joven', 'mayor', 'menor',
            'primero', 'último', 'mejor', 'peor'
        ]);
        
        return commonWords.has(word.toLowerCase());
    }
    
    /**
     * Añade consulta al historial
     */
    addToHistory(text, detection) {
        const entry = {
            text: text,
            detection: detection,
            timestamp: Date.now(),
            processed: true
        };
        
        this.queryHistory.unshift(entry);
        
        // Mantener tamaño máximo
        if (this.queryHistory.length > this.maxHistorySize) {
            this.queryHistory = this.queryHistory.slice(0, this.maxHistorySize);
        }
    }
    
    /**
     * Actualiza categorías frecuentes
     */
    updateFrequentCategories(type) {
        const currentCount = this.frequentCategories.get(type) || 0;
        this.frequentCategories.set(type, currentCount + 1);
    }
    
    /**
     * Obtiene estadísticas del detector
     */
    getStats() {
        const totalDetected = this.queryHistory.length;
        const recentDetections = this.queryHistory.slice(0, 10);
        
        // Calcular distribución de tipos
        const typeDistribution = {};
        for (const [type, count] of this.frequentCategories.entries()) {
            typeDistribution[type] = count;
        }
        
        return {
            total_detections: totalDetected,
            recent_detections: recentDetections.map(d => ({
                text: d.text.substring(0, 30) + '...',
                type: d.detection.type,
                confidence: d.detection.confidence.toFixed(2)
            })),
            type_distribution: typeDistribution,
            frequent_categories: Array.from(this.frequentCategories.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            config: {
                patterns_count: this.patterns.length,
                keywords_count: this.keywords.size,
                conversation_patterns: this.conversationPatterns.length
            }
        };
    }
    
    /**
     * Limpia el historial
     */
    clearHistory() {
        this.queryHistory = [];
        this.frequentCategories.clear();
        console.log('🧹 Historial de KnowledgeDetector limpiado');
    }
    
    /**
     * Analiza mensaje sin buscar conocimiento (solo análisis)
     */
    analyzeMessage(message) {
        const text = message.toLowerCase().trim();
        
        return {
            length: text.length,
            has_question_mark: text.includes('?'),
            has_exclamation: text.includes('!'),
            word_count: text.split(/\s+/).length,
            sentence_count: text.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
            has_numbers: /\d/.test(text),
            has_capitals: /[A-ZÁÉÍÓÚÑ]/.test(text),
            emotion_score: this.hasEmotionWords(text),
            knowledge_keywords: Array.from(this.keywords).filter(kw => text.includes(kw)),
            likely_conversation: this.isConversation(text),
            likely_knowledge_query: this.hasKnowledgeKeywords(text),
            complexity_score: this.calculateBaseConfidence(text)
        };
    }
    
    /**
     * Test del detector
     */
    testDetector(testMessages) {
        const results = [];
        
        const testCases = testMessages || [
            'Qué es la inteligencia artificial?',
            'Hola, cómo estás?',
            'Cuéntame sobre la historia de Roma',
            'Me siento muy feliz hoy',
            'Explica cómo funciona el machine learning',
            'Significado de la vida',
            'Buenos días!',
            'Cuáles son las características de Python?',
            'Gracias por tu ayuda',
            'Dónde se encuentra el Monte Everest?'
        ];
        
        for (const testCase of testCases) {
            const detection = this.shouldFetchKnowledge(testCase);
            const analysis = this.analyzeMessage(testCase);
            
            results.push({
                input: testCase,
                should_fetch: detection.shouldFetch,
                confidence: detection.confidence?.toFixed(2) || 'N/A',
                topic: detection.topic || 'N/A',
                type: detection.type || 'N/A',
                analysis_summary: {
                    length: analysis.length,
                    word_count: analysis.word_count,
                    has_question: analysis.has_question_mark,
                    emotion: analysis.emotion_score
                }
            });
        }
        
        return {
            test_results: results,
            summary: {
                total_tests: results.length,
                knowledge_queries: results.filter(r => r.should_fetch).length,
                conversation: results.filter(r => !r.should_fetch).length,
                avg_confidence: results
                    .filter(r => r.confidence !== 'N/A')
                    .reduce((sum, r) => sum + parseFloat(r.confidence), 0) / results.length
            },
            detector_stats: this.getStats()
        };
    }
}

// Instancia global
const knowledgeDetector = new KnowledgeDetector();

export { knowledgeDetector };
export default KnowledgeDetector;
