// src/services/knowledge-integration.js

import { knowledgeDetector } from '../utils/knowledge-detector.js';

class KnowledgeIntegration {
    constructor() {
        this.enabled = process.env.ENABLE_KNOWLEDGE !== 'false';
        console.log(`🧠 Integración de conocimiento: ${this.enabled ? 'ACTIVADA' : 'DESACTIVADA'}`);
    }
    
    /**
     * Procesa un mensaje para detectar si necesita conocimiento
     */
    async processMessage(message) {
        if (!this.enabled || message.length < 5) {
            return null;
        }
        
        const detection = knowledgeDetector.shouldFetchKnowledge(message);
        
        if (!detection.shouldFetch) {
            return null;
        }
        
        console.log(`🔍 Detectada consulta de conocimiento: "${detection.topic}"`);
        
        // Devolver solo la detección, la búsqueda real se hará en otro lugar
        return {
            needsKnowledge: true,
            topic: detection.topic,
            type: detection.type,
            confidence: detection.confidence,
            timestamp: Date.now()
        };
    }
    
    /**
     * Obtiene información básica (sin APIs externas)
     */
    async getBasicKnowledge(topic) {
        // Respuestas predefinidas para temas comunes
        const predefinedKnowledge = {
            'inteligencia artificial': {
                content: `La **Inteligencia Artificial** es la simulación de procesos de inteligencia humana por máquinas, especialmente sistemas informáticos. Incluye aprendizaje automático, procesamiento de lenguaje natural, visión por computadora y robótica.`,
                source: 'conocimiento general'
            },
            'machine learning': {
                content: `El **Machine Learning** es un subcampo de la inteligencia artificial que se centra en desarrollar algoritmos que permiten a las computadoras aprender y mejorar automáticamente a través de la experiencia.`,
                source: 'conocimiento general'
            },
            'javascript': {
                content: `**JavaScript** es un lenguaje de programación interpretado, orientado a objetos, utilizado principalmente en el desarrollo web para crear interactividad en las páginas web.`,
                source: 'conocimiento general'
            },
            'python': {
                content: `**Python** es un lenguaje de programación interpretado, de alto nivel y multipropósito, conocido por su sintaxis clara y legible. Es ampliamente usado en ciencia de datos, IA y desarrollo web.`,
                source: 'conocimiento general'
            }
        };
        
        const lowerTopic = topic.toLowerCase();
        
        // Buscar coincidencias parciales
        for (const [key, value] of Object.entries(predefinedKnowledge)) {
            if (lowerTopic.includes(key) || key.includes(lowerTopic)) {
                return {
                    ...value,
                    topic: key,
                    found: true
                };
            }
        }
        
        // Si no hay conocimiento predefinido
        return {
            content: `Sobre **${topic}**, puedo decirte que es un tema interesante. Sin embargo, mi base de conocimiento actual no tiene información específica sobre esto.`,
            source: 'respuesta general',
            found: false,
            topic: topic
        };
    }
}

export const knowledgeIntegration = new KnowledgeIntegration();
