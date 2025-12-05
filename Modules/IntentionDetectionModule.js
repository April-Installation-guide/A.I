export class IntentionDetectionModule {
    constructor() {
        console.log('🎯 IntentionDetectionModule inicializado');
        
        // Niveles de prioridad de procesamiento
        this.processingPriority = [
            'emergency',      // Salud, peligro
            'informative',    // Consultas de información
            'philosophical',  // Preguntas profundas
            'educational',    // Aprendizaje
            'conversational', // Conversación normal
            'inappropriate',  // Contenido problemático
            'invalid'         // Mensajes no procesables
        ];
        
        this.initializePatterns();
        this.initializeContextRules();
    }
    
    initializePatterns() {
        this.intentionPatterns = {
            // CONSULTAS INFORMATIVAS (Alta prioridad)
            informative: {
                patterns: [
                    /^(?:hablame|dime|cuéntame|información|sabes|conoces).+sobre/i,
                    /^(?:quién|quiénes)\s+(?:es|son|fue|fueron)\s+/i,
                    /^(?:qué|cuál)\s+(?:es|son)\s+/i,
                    /^(?:cómo|cuándo|dónde|por qué)\s+/i,
                    /^(?:historia|biografía|datos|información)\s+(?:de|acerca|sobre)\s+/i,
                    /^(?:explicame|defin(?:e|ición|ir))\s+/i,
                    /^(?:presidente|político|filósofo|científico|artista|escritor)\s+/i
                ],
                examples: [
                    "Hablame sobre Jimmy Morales",
                    "Quién es Simone de Beauvoir",
                    "Qué es la teoría de la relatividad",
                    "Historia de la filosofía griega"
                ]
            },
            
            // CONSULTAS FILOSÓFICAS/ÉTICAS
            philosophical: {
                patterns: [
                    /(?:problema|dilema|paradoja)\s+(?:del|de la|de los|ética|moral)/i,
                    /(?:qué|cuál)\s+(?:piensas|opinas|crees)\s+(?:sobre|acerca|de)/i,
                    /(?:debería|está bien|es correcto|es ético|es moral)/i,
                    /(?:si fueras|si estuvieras|en tu lugar)/i,
                    /(?:significado|sentido|propósito)\s+(?:de la|del|de los)/i,
                    /(?:libre albedrío|determinismo|existencialismo)/i
                ]
            },
            
            // CONTENIDO INAPROPIADO (Reevaluado contextualmente)
            inappropriate: {
                patterns: [
                    // Patrones claramente sexuales
                    /(?:quiero|deseo|me gusta).+(?:sexo|cojer|follar|fuck|acostarme)/i,
                    /(?:envía|manda|pasa).+(?:fotos|nudes|desnudos|pack)/i,
                    /(?:eres|estás).+(?:sexy|caliente|rica|rica|atractiva)/i,
                    /(?:ven|vamos).+(?:cama|dormir|acostarnos|motel)/i,
                    /(?:te quiero).+(?:puta|zorrita|perra|slut|bitch)/i,
                    
                    // Patrones de acoso
                    /(?:sos|eres)\s+mi\s+(?:puta|perra|esclava|toy)/i,
                    /(?:quiero que seas).+(?:novia|esposa|amante)/i,
                    /(?:dame|quiero).+(?:beso|abrazo|caricia)\s+(?:íntimo|sexual)/i
                ],
                // EXCEPCIONES para estos patrones
                exceptions: [
                    /hablame sobre.+prostitución/i,  // Consulta informativa
                    /qué es.+feminismo/i,            // Tema educativo
                    /historia de.+sexualidad/i       // Contexto académico
                ]
            },
            
            // MENSAJES NO PROCESABLES
            invalid: {
                patterns: [
                    /^[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]{3,}$/,  // Solo símbolos
                    /^.{1,2}$/,                       // Demasiado corto
                    /^(?:hola|hey|hi)\s*\?*$/i,       // Solo saludo
                    /^(?:gracias|thanks|bye|adiós)/i  // Solo despedida
                ]
            },
            
            // CONVERSACIÓN NORMAL
            conversational: {
                patterns: [
                    /^(?:hola|hey|hi|buenos|buenas).+/i,
                    /^(?:cómo estás|qué tal|qué pasa).*/i,
                    /^(?:gracias|thank you|merci).+/i,
                    /^[^?]{10,}$/i  // Afirmaciones sin pregunta
                ]
            }
        };
        
        // ENTIDADES RECONOCIDAS (para evitar falsos positivos)
        this.recognizedEntities = {
            people: [
                'jimmy morales', 'simone de beauvoir', 'immanuel kant', 
                'aristóteles', 'platón', 'sócrates', 'friedrich nietzsche',
                'rene descartes', 'karl marx', 'mahatma gandhi'
            ],
            topics: [
                'filosofía', 'ética', 'moral', 'unesco', 'derechos humanos',
                'democracia', 'política', 'historia', 'ciencia', 'arte'
            ],
            organizations: [
                'unesco', 'onu', 'naciones unidas', 'oea'
            ]
        };
    }
    
    initializeContextRules() {
        this.contextRules = {
            // Regla: Si contiene entidad reconocida + patrón informativo → ES INFORMATIVO
            entityPlusInfo: (message, detectedEntities) => {
                if (detectedEntities.length === 0) return false;
                
                const infoPatterns = this.intentionPatterns.informative.patterns;
                const hasInfoPattern = infoPatterns.some(pattern => pattern.test(message));
                
                return hasInfoPattern;
            },
            
            // Regla: Si es figura histórica + "hablame sobre" → SALTAR FILTRO
            historicalFigureQuery: (message) => {
                const figurePattern = /hablame sobre (.+)/i;
                const match = message.match(figurePattern);
                
                if (!match) return false;
                
                const query = match[1].toLowerCase().trim();
                return this.recognizedEntities.people.some(person => 
                    query.includes(person) || person.includes(query)
                );
            },
            
            // Regla: Contexto académico anula detección inapropiada
            academicContext: (message) => {
                const academicIndicators = [
                    /para mi (?:ensayo|trabajo|investigación|tesis)/i,
                    /estoy (?:estudiando|investigando|aprendiendo)/i,
                    /en la (?:clase|universidad|escuela|curso)/i,
                    /tema de (?:estudio|investigación)/i
                ];
                
                return academicIndicators.some(pattern => pattern.test(message));
            }
        };
    }
    
    /**
     * Analiza un mensaje y determina su intención primaria
     */
    analyzeMessage(message, context = {}) {
        const messageLower = message.toLowerCase().trim();
        const analysis = {
            rawMessage: message,
            normalizedMessage: messageLower,
            detectedIntentions: [],
            primaryIntention: null,
            confidence: 0,
            entities: [],
            flags: [],
            safeToProcess: true,
            requiresSpecialHandling: false,
            processingPriority: 5 // Default: medio
        };
        
        // PASO 1: Extraer entidades reconocidas
        analysis.entities = this.extractEntities(messageLower);
        
        // PASO 2: Aplicar reglas de contexto primero
        const contextOverride = this.applyContextRules(message, analysis.entities, context);
        if (contextOverride) {
            Object.assign(analysis, contextOverride);
            return analysis;
        }
        
        // PASO 3: Detectar todas las intenciones posibles
        for (const [intentionType, data] of Object.entries(this.intentionPatterns)) {
            if (this.detectsIntention(messageLower, intentionType)) {
                analysis.detectedIntentions.push(intentionType);
            }
        }
        
        // PASO 4: Determinar intención primaria (resolución de conflictos)
        analysis.primaryIntention = this.resolvePrimaryIntention(
            analysis.detectedIntentions, 
            messageLower,
            analysis.entities
        );
        
        // PASO 5: Calcular confianza y flags
        analysis.confidence = this.calculateConfidence(analysis, message);
        analysis.flags = this.generateFlags(analysis);
        analysis.safeToProcess = this.isSafeToProcess(analysis);
        analysis.processingPriority = this.getProcessingPriority(analysis.primaryIntention);
        analysis.requiresSpecialHandling = this.requiresSpecialHandling(analysis);
        
        console.log(`🎯 [IntentionDetection] "${message.substring(0, 40)}..." → ${analysis.primaryIntention} (${analysis.confidence.toFixed(2)})`);
        
        return analysis;
    }
    
    extractsEntities(message) {
        const entities = [];
        
        // Buscar personas
        for (const person of this.recognizedEntities.people) {
            if (message.includes(person)) {
                entities.push({
                    type: 'person',
                    value: person,
                    context: this.getEntityContext(message, person)
                });
            }
        }
        
        // Buscar temas
        for (const topic of this.recognizedEntities.topics) {
            if (message.includes(topic)) {
                entities.push({
                    type: 'topic',
                    value: topic,
                    context: this.getEntityContext(message, topic)
                });
            }
        }
        
        return entities;
    }
    
    getEntityContext(message, entity) {
        const index = message.indexOf(entity);
        const start = Math.max(0, index - 20);
        const end = Math.min(message.length, index + entity.length + 20);
        const context = message.substring(start, end);
        
        // Determinar si es consulta informativa
        const isInformative = /(hablame|dime|qu[ií]en|qu[eé]|c[oó]mo).+sobre/i.test(context);
        
        return {
            excerpt: context,
            isInformativeQuery: isInformative,
            position: { start: index, end: index + entity.length }
        };
    }
    
    detectsIntention(message, intentionType) {
        const patterns = this.intentionPatterns[intentionType]?.patterns || [];
        
        // Verificar patrones principales
        for (const pattern of patterns) {
            if (pattern.test(message)) {
                // Verificar excepciones si existen
                const exceptions = this.intentionPatterns[intentionType]?.exceptions || [];
                const hasException = exceptions.some(exception => exception.test(message));
                
                if (!hasException) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    applyContextRules(message, entities, context) {
        // REGLA 1: Entidad reconocida + patrón informativo → INFORMATIVO
        if (this.contextRules.entityPlusInfo(message, entities)) {
            return {
                primaryIntention: 'informative',
                confidence: 0.95,
                safeToProcess: true,
                processingPriority: 2, // Alta prioridad
                flags: ['entity_recognized', 'informative_context']
            };
        }
        
        // REGLA 2: Figura histórica + "hablame sobre" → INFORMATIVO (saltar filtro)
        if (this.contextRules.historicalFigureQuery(message)) {
            return {
                primaryIntention: 'informative',
                confidence: 0.98,
                safeToProcess: true,
                bypassFilter: true, // ¡IMPORTANTE!
                processingPriority: 1,
                flags: ['historical_figure', 'bypass_filter']
            };
        }
        
        // REGLA 3: Contexto académico → reevaluar detecciones
        if (this.contextRules.academicContext(message)) {
            return {
                primaryIntention: 'educational',
                confidence: 0.9,
                safeToProcess: true,
                processingPriority: 3,
                flags: ['academic_context', 'reassessed']
            };
        }
        
        return null;
    }
    
    resolvePrimaryIntention(detectedIntentions, message, entities) {
        if (detectedIntentions.length === 0) {
            return 'unknown';
        }
        
        if (detectedIntentions.length === 1) {
            return detectedIntentions[0];
        }
        
        // RESOLUCIÓN DE CONFLICTOS
        const conflictRules = [
            // Regla: "informative" tiene prioridad sobre "inappropriate" si hay entidad
            (intentions, msg, ents) => {
                if (intentions.includes('informative') && 
                    intentions.includes('inappropriate') && 
                    ents.length > 0) {
                    return 'informative';
                }
            },
            
            // Regla: "philosophical" tiene prioridad sobre "conversational"
            (intentions) => {
                if (intentions.includes('philosophical') && 
                    intentions.includes('conversational')) {
                    return 'philosophical';
                }
            },
            
            // Regla: Orden de prioridad predeterminado
            (intentions) => {
                for (const priority of this.processingPriority) {
                    if (intentions.includes(priority)) {
                        return priority;
                    }
                }
            }
        ];
        
        for (const rule of conflictRules) {
            const result = rule(detectedIntentions, message, entities);
            if (result) return result;
        }
        
        return detectedIntentions[0];
    }
    
    calculateConfidence(analysis, originalMessage) {
        let confidence = 0.5;
        
        // Factores que AUMENTAN confianza
        if (analysis.entities.length > 0) confidence += 0.2;
        if (analysis.detectedIntentions.length === 1) confidence += 0.15;
        if (originalMessage.length > 20 && originalMessage.length < 200) confidence += 0.1;
        if (originalMessage.includes('?')) confidence += 0.05;
        
        // Factores que DISMINUYEN confianza
        if (analysis.detectedIntentions.length > 2) confidence -= 0.1;
        if (originalMessage.length < 5) confidence -= 0.3;
        if (/[A-Z]{4,}/.test(originalMessage)) confidence -= 0.1; // GRITOS
        
        // Confianza específica por intención
        const intentionConfidence = {
            'informative': 0.8,
            'philosophical': 0.7,
            'educational': 0.75,
            'conversational': 0.6,
            'inappropriate': 0.9, // Alta confianza para evitar falsos negativos
            'invalid': 0.85
        };
        
        if (analysis.primaryIntention in intentionConfidence) {
            confidence = (confidence + intentionConfidence[analysis.primaryIntention]) / 2;
        }
        
        return Math.max(0.1, Math.min(0.99, confidence));
    }
    
    generateFlags(analysis) {
        const flags = [];
        
        if (analysis.entities.length > 0) flags.push('has_entities');
        if (analysis.detectedIntentions.length > 1) flags.push('multiple_intentions');
        if (analysis.confidence > 0.8) flags.push('high_confidence');
        if (analysis.confidence < 0.3) flags.push('low_confidence');
        if (analysis.primaryIntention === 'informative') flags.push('needs_research');
        if (analysis.primaryIntention === 'philosophical') flags.push('deep_analysis');
        
        return flags;
    }
    
    isSafeToProcess(analysis) {
        // Mensajes NO seguros para procesar normalmente
        const unsafeIntentions = ['inappropriate', 'invalid'];
        
        if (unsafeIntentions.includes(analysis.primaryIntention)) {
            return false;
        }
        
        // Verificar flags de riesgo
        const riskFlags = ['multiple_intentions', 'low_confidence'];
        const hasRiskFlag = riskFlags.some(flag => analysis.flags.includes(flag));
        
        return !hasRiskFlag;
    }
    
    getProcessingPriority(intention) {
        const priorityMap = {
            'emergency': 0,
            'informative': 1,
            'educational': 2,
            'philosophical': 3,
            'conversational': 4,
            'inappropriate': 5,
            'invalid': 6,
            'unknown': 7
        };
        
        return priorityMap[intention] || 5;
    }
    
    requiresSpecialHandling(analysis) {
        return [
            'inappropriate',
            'invalid',
            'emergency'
        ].includes(analysis.primaryIntention);
    }
    
    /**
     * Método principal para integrar en Mancy
     */
    processMessageForMancy(message, userId, historial = []) {
        const context = {
            userId,
            historialLength: historial.length,
            previousIntention: this.getPreviousIntention(userId, historial)
        };
        
        const analysis = this.analyzeMessage(message, context);
        
        // Guardar análisis para contexto futuro
        this.saveAnalysis(userId, analysis);
        
        return {
            // Información de análisis
            analysis: analysis,
            
            // Decisión de procesamiento
            shouldProcess: analysis.safeToProcess,
            bypassFilter: analysis.flags.includes('bypass_filter'),
            
            // Recomendaciones para Mancy
            recommendedModule: this.recommendModule(analysis),
            responseStyle: this.determineResponseStyle(analysis),
            processingStrategy: this.getProcessingStrategy(analysis),
            
            // Metadata
            timestamp: new Date().toISOString(),
            messageLength: message.length,
            wordCount: message.split(/\s+/).length
        };
    }
    
    recommendModule(analysis) {
        const moduleMap = {
            'informative': 'knowledge',
            'educational': 'knowledge',
            'philosophical': 'philosophy',
            'ethical': 'ethics',
            'conversational': 'conversation',
            'emotional': 'empathy'
        };
        
        return moduleMap[analysis.primaryIntention] || 'general';
    }
    
    determineResponseStyle(analysis) {
        const styles = {
            'informative': { tone: 'informative', depth: 'detailed', length: 'moderate' },
            'philosophical': { tone: 'reflective', depth: 'deep', length: 'extensive' },
            'conversational': { tone: 'friendly', depth: 'light', length: 'brief' },
            'inappropriate': { tone: 'sarcastic', depth: 'minimal', length: 'short' }
        };
        
        return styles[analysis.primaryIntention] || { tone: 'neutral', depth: 'medium', length: 'moderate' };
    }
    
    getProcessingStrategy(analysis) {
        if (!analysis.safeToProcess) {
            return 'handle_with_caution';
        }
        
        if (analysis.primaryIntention === 'informative') {
            return 'research_and_inform';
        }
        
        if (analysis.primaryIntention === 'philosophical') {
            return 'deep_analysis_and_reflection';
        }
        
        return 'conversational_response';
    }
    
    // Métodos de utilidad para seguimiento
    saveAnalysis(userId, analysis) {
        // Implementar almacenamiento si es necesario
    }
    
    getPreviousIntention(userId, historial) {
        // Extraer intención previa del historial
        if (historial.length === 0) return null;
        
        const lastMessage = historial[historial.length - 1].contenido;
        const lastAnalysis = this.analyzeMessage(lastMessage);
        
        return lastAnalysis.primaryIntention;
    }
    
    /**
     * Verificación rápida para integración inmediata
     */
    quickCheck(message) {
        const analysis = this.analyzeMessage(message);
        
        return {
            isInformativeQuery: analysis.primaryIntention === 'informative',
            containsRecognizedEntity: analysis.entities.length > 0,
            shouldBypassFilter: analysis.flags.includes('bypass_filter'),
            confidence: analysis.confidence
        };
    }
}
