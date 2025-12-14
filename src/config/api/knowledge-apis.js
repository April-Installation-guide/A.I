import natural from 'natural';
const { WordTokenizer } = natural;

class KnowledgeDetector {
    constructor() {
        this.tokenizer = new WordTokenizer();
        this.minimumConfidence = 0.4;
        
        // Patrones de preguntas de conocimiento
        this.knowledgePatterns = {
            definicion: [
                /qué es\s+(.+)/i,
                /defin[eíí]?\s+(.+)/i,
                /significado de\s+(.+)/i,
                /qué significa\s+(.+)/i,
                /explica qué es\s+(.+)/i
            ],
            
            historia: [
                /historia de\s+(.+)/i,
                /quién (fue|era)\s+(.+)/i,
                /cuándo (ocurrió|sucedió|fue)\s+(.+)/i,
                /origen de\s+(.+)/i,
                /cómo (empezó|comenzó|nació)\s+(.+)/i
            ],
            
            biografia: [
                /quién es\s+(.+)/i,
                /biografía de\s+(.+)/i,
                /vida de\s+(.+)/i,
                /información sobre\s+(.+)/i,
                /hablame de\s+(.+)/i,
                /dime sobre\s+(.+)/i
            ],
            
            concepto: [
                /cómo funciona\s+(.+)/i,
                /qué son\s+(.+)/i,
                /en qué consiste\s+(.+)/i,
                /características de\s+(.+)/i,
                /para qué sirve\s+(.+)/i
            ],
            
            datos: [
                /datos (de|sobre)\s+(.+)/i,
                /información de\s+(.+)/i,
                /curiosidades de\s+(.+)/i,
                /hechos sobre\s+(.+)/i
            ]
        };
        
        // Palabras clave que indican necesidad de conocimiento
        this.knowledgeKeywords = [
            'qué', 'quién', 'cuándo', 'dónde', 'cómo', 'por qué',
            'definición', 'significado', 'historia', 'origen',
            'biografía', 'información', 'datos', 'hechos',
            'explica', 'describe', 'habla', 'cuéntame',
            'conoces', 'sabes', 'explicación', 'concepto'
        ];
        
        // Excepciones: temas que NO deben disparar búsqueda
        this.exceptions = [
            'cómo estás', 'qué tal', 'hola', 'buenos días',
            'adiós', 'gracias', 'por favor', 'qué haces',
            'qué pasa', 'qué onda', 'qué hubo'
        ];
    }
    
    /**
     * Detecta si un mensaje requiere información de conocimiento
     */
    shouldFetchKnowledge(message) {
        const text = message.toLowerCase().trim();
        
        // Verificar excepciones
        if (this.isException(text)) {
            return { shouldFetch: false };
        }
        
        // Buscar patrones específicos
        const patternMatch = this.matchPatterns(text);
        if (patternMatch.found) {
            return {
                shouldFetch: true,
                confidence: 0.8,
                topic: patternMatch.topic,
                type: patternMatch.type,
                context: patternMatch.context
            };
        }
        
        // Verificar palabras clave
        const keywordMatch = this.checkKeywords(text);
        if (keywordMatch.found) {
            return {
                shouldFetch: true,
                confidence: keywordMatch.confidence,
                topic: keywordMatch.topic,
                type: keywordMatch.type || 'general',
                context: 'keyword_match'
            };
        }
        
        // Verificar si es una pregunta (contiene signo de interrogación)
        if (text.includes('?')) {
            const questionMatch = this.extractQuestionTopic(text);
            if (questionMatch) {
                return {
                    shouldFetch: true,
                    confidence: 0.5,
                    topic: questionMatch,
                    type: 'question',
                    context: 'question_mark'
                };
            }
        }
        
        return { shouldFetch: false };
    }
    
    /**
     * Verifica si el texto es una excepción
     */
    isException(text) {
        return this.exceptions.some(exception => 
            text.includes(exception.toLowerCase())
        );
    }
    
    /**
     * Busca coincidencias con patrones específicos
     */
    matchPatterns(text) {
        for (const [type, patterns] of Object.entries(this.knowledgePatterns)) {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    return {
                        found: true,
                        topic: this.cleanTopic(match[1]),
                        type: type,
                        context: pattern.source
                    };
                }
            }
        }
        
        return { found: false };
    }
    
    /**
     * Verifica palabras clave en el texto
     */
    checkKeywords(text) {
        const tokens = this.tokenizer.tokenize(text);
        let keywordCount = 0;
        let confidence = 0;
        let detectedType = 'general';
        
        // Contar palabras clave
        tokens.forEach(token => {
            if (this.knowledgeKeywords.includes(token.toLowerCase())) {
                keywordCount++;
            }
        });
        
        // Calcular confianza basada en densidad de palabras clave
        if (tokens.length > 0) {
            confidence = keywordCount / tokens.length;
        }
        
        // Determinar tipo basado en palabras clave específicas
        if (text.includes('definición') || text.includes('significado')) {
            detectedType = 'definicion';
        } else if (text.includes('historia') || text.includes('origen')) {
            detectedType = 'historia';
        } else if (text.includes('biografía') || text.includes('vida')) {
            detectedType = 'biografia';
        } else if (text.includes('cómo funciona') || text.includes('concepto')) {
            detectedType = 'concepto';
        }
        
        // Extraer tema principal (últimas palabras como tema probable)
        const topic = this.extractTopicFromText(text);
        
        return {
            found: confidence >= this.minimumConfidence,
            confidence: confidence,
            topic: topic,
            type: detectedType
        };
    }
    
    /**
     * Extrae tema de una pregunta
     */
    extractQuestionTopic(text) {
        // Eliminar signos de interrogación
        let cleaned = text.replace(/\?/g, '').trim();
        
        // Eliminar palabras interrogativas comunes
        const questionWords = ['qué', 'quién', 'cuándo', 'dónde', 'cómo', 'por qué', 'cuál', 'cuáles'];
        questionWords.forEach(word => {
            cleaned = cleaned.replace(new RegExp(`^${word}\\s+`, 'i'), '');
        });
        
        // Eliminar artículos y preposiciones comunes al inicio
        const stopWords = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al'];
        stopWords.forEach(word => {
            cleaned = cleaned.replace(new RegExp(`^${word}\\s+`, 'i'), '');
        });
        
        return this.cleanTopic(cleaned);
    }
    
    /**
     * Extrae tema general del texto
     */
    extractTopicFromText(text) {
        const tokens = this.tokenizer.tokenize(text);
        
        // Eliminar palabras comunes y cortas
        const commonWords = ['es', 'son', 'fue', 'era', 'ser', 'estar', 'tener', 'hacer', 'poder', 'decir'];
        const filteredTokens = tokens.filter(token => 
            token.length > 2 && !commonWords.includes(token.toLowerCase())
        );
        
        // Tomar las últimas 2-4 palabras como tema
        const topicLength = Math.min(4, Math.max(2, filteredTokens.length));
        const topicTokens = filteredTokens.slice(-topicLength);
        
        return this.cleanTopic(topicTokens.join(' '));
    }
    
    /**
     * Limpia y normaliza el tema
     */
    cleanTopic(topic) {
        if (!topic) return '';
        
        return topic
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ\-]/gi, '')
            .substring(0, 100); // Limitar longitud
    }
    
    /**
     * Determina qué API usar basado en el tipo de consulta
     */
    determineAPI(type, topic) {
        const apis = [];
        
        switch(type) {
            case 'definicion':
                apis.push({ name: 'dictionary', priority: 1 });
                apis.push({ name: 'wikipedia', priority: 2 });
                break;
                
            case 'historia':
                apis.push({ name: 'wikipedia', priority: 1 });
                apis.push({ name: 'historical', priority: 2 });
                break;
                
            case 'biografia':
                apis.push({ name: 'wikipedia', priority: 1 });
                apis.push({ name: 'philosophy', priority: 2 });
                break;
                
            case 'concepto':
                apis.push({ name: 'wikipedia', priority: 1 });
                apis.push({ name: 'programming', priority: 2 });
                break;
                
            default:
                apis.push({ name: 'wikipedia', priority: 1 });
                apis.push({ name: 'books', priority: 3 });
                break;
        }
        
        // Ordenar por prioridad
        return apis.sort((a, b) => a.priority - b.priority);
    }
}

export const knowledgeDetector = new KnowledgeDetector();
