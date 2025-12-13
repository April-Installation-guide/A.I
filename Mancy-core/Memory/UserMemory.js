// memory/UserMemory.js
class UserMemory {
    constructor(coreMemory) {
        this.core = coreMemory;
    }
    
    async getFullUserContext(userId) {
        const user = await this.core.getUser(userId);
        const recentConvs = await this.core.getRecentConversations(userId, 5);
        const facts = await this.core.getRelevantFacts(userId);
        
        return {
            // Información básica del usuario
            user: {
                id: user.id,
                name: user.name,
                firstSeen: user.first_seen,
                interactionCount: user.interaction_count,
                preferences: user.preferences
            },
            
            // Contexto conversacional reciente
            recentConversations: recentConvs.slice(0, 3).map(conv => ({
                user: conv.user_message.substring(0, 100),
                bot: conv.bot_response.substring(0, 100)
            })),
            
            // Hechos importantes sobre el usuario
            knownFacts: facts.map(f => ({
                fact: f.fact,
                category: f.category,
                confidence: f.confidence
            })),
            
            // Resumen de la relación
            relationshipSummary: this.generateRelationshipSummary(user, facts, recentConvs)
        };
    }
    
    generateRelationshipSummary(user, facts, conversations) {
        const interactionCount = user.interaction_count || 0;
        
        if (interactionCount === 0) return "Nueva interacción";
        if (interactionCount < 5) return "Conociéndose";
        if (interactionCount < 20) return "Familiar";
        
        // Analizar temas recurrentes
        const topics = this.core.extractTopics(conversations);
        if (topics.length > 0) {
            return `Hablan frecuentemente de: ${topics.join(', ')}`;
        }
        
        return "Interacción establecida";
    }
    
    async learnAboutUser(userId, observation, category = 'personal') {
        // Extraer posibles hechos de una observación
        const facts = this.extractFactsFromObservation(observation);
        
        for (const fact of facts) {
            await this.core.learnFact(userId, fact, category);
        }
        
        return facts.length;
    }
    
    extractFactsFromObservation(text) {
        // Patrones simples para extraer información
        const patterns = [
            /(?:mi|me llamo|soy) (?:llamo )?([A-Z][a-z]+(?: [A-Z][a-z]+)?)/i,
            /(?:tengo|edad) (\d+) años/i,
            /(?:vivo en|soy de) ([^,.!?]+)/i,
            /(?:trabajo como|soy) ([^,.!?]+)/i,
            /(?:me gusta|amo|adoro) ([^,.!?]+)/i,
            /(?:odio|detesto|no me gusta) ([^,.!?]+)/i
        ];
        
        const facts = [];
        
        patterns.forEach(pattern => {
            const match = text.match(pattern);
            if (match && match[1]) {
                facts.push(match[0]); // Guardar toda la frase
            }
        });
        
        return facts;
    }
}
