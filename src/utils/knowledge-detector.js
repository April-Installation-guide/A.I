// src/utils/knowledge-detector.js

class KnowledgeDetector {
    constructor() {
        // Patrones básicos de preguntas
        this.patterns = [
            // Qué es...
            { regex: /^(qué|que)\s+es\s+(.+)/i, type: 'definicion', group: 2 },
            { regex: /^defin(e|ición|ir)\s+(.+)/i, type: 'definicion', group: 2 },
            { regex: /^significado\s+(de|del|de la)?\s*(.+)/i, type: 'definicion', group: 2 },
            
            // Quién es...
            { regex: /^(quién|quien)\s+(es|fue|era)\s+(.+)/i, type: 'biografia', group: 3 },
            { regex: /^biografía\s+(de|del|de la)?\s*(.+)/i, type: 'biografia', group: 2 },
            
            // Historia...
            { regex: /^historia\s+(de|del|de la)?\s*(.+)/i, type: 'historia', group: 2 },
            { regex: /^origen\s+(de|del|de la)?\s*(.+)/i, type: 'historia', group: 2 },
            
            // Cómo funciona...
            { regex: /^cómo\s+funciona\s+(.+)/i, type: 'concepto', group: 1 },
            { regex: /^explica\s+(.+)/i, type: 'concepto', group: 1 },
            
            // Información sobre...
            { regex: /^(información|datos|habla|cuéntame|dime)\s+(sobre|de|acerca de)\s*(.+)/i, type: 'general', group: 3 },
            
            // Preguntas con ?
            { regex: /^(.+)\?$/i, type: 'pregunta', group: 1 }
        ];
        
        // Palabras clave de conocimiento
        this.keywords = new Set([
            'qué', 'que', 'quién', 'quien', 'cómo', 'como', 'cuándo', 'cuando',
            'dónde', 'donde', 'por qué', 'porque', 'definición', 'definir',
            'significado', 'historia', 'origen', 'biografía', 'información',
            'datos', 'explica', 'explicación', 'concepto', 'funciona'
        ]);
        
        // Excepciones (conversación normal)
        this.exceptions = new Set([
            'hola', 'holi', 'hey', 'hi', 'hello',
            'cómo estás', 'qué tal', 'qué haces',
            'buenos días', 'buenas tardes', 'buenas noches',
            'adiós', 'chao', 'bye', 'nos vemos',
            'gracias', 'thanks', 'merci',
            'de nada', 'por favor', 'please',
            'qué pasa', 'qué onda', 'qué hubo',
            'estoy bien', 'estoy mal', 'me siento',
            'te amo', 'te quiero', 'me gustas'
        ]);
    }
    
    /**
     * Detecta si es una pregunta de conocimiento
     */
    shouldFetchKnowledge(message) {
        const text = message.toLowerCase().trim();
        
        // Verificar excepciones rápidas
        if (this.isException(text)) {
            return { shouldFetch: false };
        }
        
        // Verificar patrones
        for (const pattern of this.patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                const topic = this.extractTopic(match[pattern.group]);
                if (topic) {
                    return {
                        shouldFetch: true,
                        confidence: 0.8,
                        topic: topic,
                        type: pattern.type
                    };
                }
            }
        }
        
        // Verificar si contiene palabras clave
        if (this.hasKeywords(text)) {
            const topic = this.extractTopic(text);
            return {
                shouldFetch: true,
                confidence: 0.5,
                topic: topic,
                type: 'general'
            };
        }
        
        return { shouldFetch: false };
    }
    
    /**
     * Extrae el tema principal
     */
    extractTopic(text) {
        // Limpiar el texto
        let cleaned = text
            .replace(/\?/g, '')
            .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ]/g, '')
            .trim();
        
        // Dividir en palabras
        const words = cleaned.split(/\s+/);
        
        // Filtrar palabras comunes
        const commonWords = new Set([
            'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
            'de', 'del', 'al', 'a', 'con', 'por', 'para', 'en',
            'es', 'son', 'fue', 'era', 'ser', 'estar'
        ]);
        
        const filtered = words.filter(word => 
            word.length > 2 && !commonWords.has(word.toLowerCase())
        );
        
        // Tomar las últimas 1-3 palabras como tema
        if (filtered.length > 0) {
            return filtered.slice(-Math.min(3, filtered.length)).join(' ');
        }
        
        return cleaned.substring(0, 50);
    }
    
    /**
     * Verifica si es una excepción
     */
    isException(text) {
        return this.exceptions.has(text) || 
               Array.from(this.exceptions).some(exception => text.startsWith(exception));
    }
    
    /**
     * Verifica palabras clave
     */
    hasKeywords(text) {
        const words = text.toLowerCase().split(/\s+/);
        return words.some(word => this.keywords.has(word));
    }
}

export const knowledgeDetector = new KnowledgeDetector();
