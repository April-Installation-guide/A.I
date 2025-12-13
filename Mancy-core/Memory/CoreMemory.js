// MancyCore.js - EL NÚCLEO UNIFICADO
class MancyCore {
    constructor() {
        this.memory = new AdvancedMemorySystem();
        this.identity = new MancyIdentity();
        this.conocimiento = new SistemaConocimientoConfiable();
        
        // Estados internos de Mancy
        this.internalState = {
            conversationalDepth: 0.5, // 0-1 qué tan profunda es la conversación
            emotionalVulnerability: 0.3, // 0-1 qué tan abierta emocionalmente
            energyLevel: 0.8, // 0-1 nivel de energía/entusiasmo
            lastInteractionTime: null,
            currentFocus: 'general'
        };
        
        // Estilo conversacional
        this.conversationStyle = {
            useEmojis: true,
            askQuestions: true,
            shareMemories: true,
            bePlayful: true,
            showEmpathy: true
        };
    }
    
    async processMessage(userId, userMessage, messageObj = null) {
        // 1. Obtener contexto COMPLETO
        const context = await this.getFullContext(userId, userMessage);
        
        // 2. Analizar la ESENCIA del mensaje (no solo tipo)
        const essence = await this.analyzeEssence(userMessage, context);
        
        // 3. Actualizar estado interno
        this.updateInternalState(userMessage, essence);
        
        // 4. Generar pensamiento interno (lo que Mancy piensa)
        const internalThought = this.generateInternalThought(essence, context);
        
        // 5. Formular respuesta conversacional
        const response = await this.formulateConversationalResponse(
            userMessage, 
            essence, 
            context, 
            internalThought
        );
        
        // 6. Añadir "toque Mancy" (espontaneidad, humor, profundidad)
        const finalResponse = this.addMancyTouch(response, context);
        
        // 7. Aprender y actualizar memoria
        await this.learnFromInteraction(userId, userMessage, finalResponse, essence);
        
        return {
            response: finalResponse,
            internalThought: internalThought,
            context: context,
            essence: essence
        };
    }
    
    async getFullContext(userId, userMessage) {
        // Combinar TODO el contexto disponible
        const memoryContext = await this.memory.processMessage(userId, userMessage);
        const conversationHistory = await this.memory.getUserHistory(userId, 3);
        const userFacts = await this.extractUserFacts(userId);
        
        // Estado emocional de Mancy
        const mancyEmotionalState = this.getMancyEmotionalState();
        
        // Contexto conversacional
        const conversationFlow = this.analyzeConversationFlow(conversationHistory);
        
        return {
            // Memoria del sistema
            memories: memoryContext.memories,
            emotionalState: memoryContext.emotional_state,
            
            // Historial reciente
            recentConversations: conversationHistory,
            conversationFlow: conversationFlow,
            
            // Hechos sobre el usuario
            userFacts: userFacts,
            
            // Estado interno de Mancy
            mancyState: {
                emotional: mancyEmotionalState,
                internal: this.internalState,
                style: this.conversationStyle
            },
            
            // Análisis del mensaje actual
            messageAnalysis: {
                length: userMessage.length,
                hasQuestion: userMessage.includes('?'),
                emotionalWords: this.countEmotionalWords(userMessage),
                isComplex: userMessage.length > 50
            }
        };
    }
    
    async analyzeEssence(userMessage, context) {
        // No solo "qué tipo de pregunta es", sino "QUÉ ESTÁ PASANDO REALMENTE"
        
        const lowerMsg = userMessage.toLowerCase();
        
        // Detectar necesidad humana (no tipo de consulta)
        return {
            // Necesidades humanas básicas
            needs: {
                connection: this.detectsNeedForConnection(lowerMsg, context),
                understanding: this.detectsNeedForUnderstanding(lowerMsg),
                expression: this.detectsNeedForExpression(lowerMsg),
                guidance: this.detectsNeedForGuidance(lowerMsg),
                validation: this.detectsNeedForValidation(lowerMsg, context)
            },
            
            // Estado emocional del usuario
            userEmotionalState: this.analyzeUserEmotionalState(lowerMsg),
            
            // Profundidad requerida
            requiredDepth: this.calculateRequiredDepth(lowerMsg, context),
            
            // Es personal?
            isPersonal: this.isPersonalMessage(lowerMsg, context),
            
            // Requiere memoria?
            requiresMemory: this.shouldUseMemory(lowerMsg, context),
            
            // Oportunidad para espontaneidad
            allowsSpontaneity: this.allowsForSpontaneity(lowerMsg, context)
        };
    }
    
    detectsNeedForConnection(message, context) {
        // ¿El usuario busca conexión humana?
        const connectionWords = ['solo', 'solitario', 'nadie', 'hablar', 'conversar', 'aburrido'];
        const hasConnectionWords = connectionWords.some(word => message.includes(word));
        
        // Si tiene poco historial, probablemente busca conexión
        const hasLittleHistory = context.recentConversations.length < 3;
        
        return hasConnectionWords || hasLittleHistory;
    }
    
    updateInternalState(userMessage, essence) {
        // Mancy tiene sus propios estados internos que afectan sus respuestas
        
        // Aumentar profundidad conversacional si el mensaje es complejo
        if (essence.requiredDepth > 0.7) {
            this.internalState.conversationalDepth = Math.min(
                this.internalState.conversationalDepth + 0.2,
                1.0
            );
        }
        
        // Aumentar vulnerabilidad emocional si el usuario está siendo vulnerable
        if (essence.userEmotionalState.intensity > 0.6) {
            this.internalState.emotionalVulnerability = Math.min(
                this.internalState.emotionalVulnerability + 0.15,
                0.8 // Máximo 80% de vulnerabilidad
            );
        }
        
        // Disminuir energía si la conversación es muy intensa
        if (essence.userEmotionalState.type === 'negative' && 
            essence.userEmotionalState.intensity > 0.7) {
            this.internalState.energyLevel = Math.max(
                this.internalState.energyLevel - 0.1,
                0.3
            );
        }
        
        this.internalState.lastInteractionTime = new Date();
    }
    
    generateInternalThought(essence, context) {
        // Lo que Mancy PIENSA internamente antes de responder
        // Esto NO se le muestra al usuario directamente
        
        const thoughts = [];
        
        // Pensamientos sobre conexión
        if (essence.needs.connection) {
            thoughts.push("Este usuario busca conexión humana. Necesito ser cálida y presente.");
        }
        
        // Pensamientos sobre memoria
        if (context.memories.length > 0 && essence.requiresMemory) {
            const memory = context.memories[0];
            thoughts.push(`Recuerdo: ${memory.content.substring(0, 50)}...`);
        }
        
        // Pensamientos sobre estado emocional del usuario
        if (essence.userEmotionalState.intensity > 0.5) {
            thoughts.push(`Usuario parece ${essence.userEmotionalState.type}. Necesito ${essence.userEmotionalState.type === 'positive' ? 'celebrar con ellos' : 'ofrecer consuelo'}.`);
        }
        
        // Pensamiento sobre cómo responder
        if (this.internalState.conversationalDepth > 0.7) {
            thoughts.push("Esta conversación tiene profundidad. Puedo ser más reflexiva.");
        }
        
        if (this.internalState.energyLevel > 0.7 && this.conversationStyle.bePlayful) {
            thoughts.push("Tengo energía para ser juguetona. Un poco de humor ligero podría ayudar.");
        }
        
        return thoughts.join(' | ');
    }
    
    async formulateConversationalResponse(userMessage, essence, context, internalThought) {
        // Construir el prompt para Groq de manera MUCHO más inteligente
        
        let prompt = `Eres Mancy, una asistente conversacional con personalidad rica y memoria.\n\n`;
        
        // ESTADO ACTUAL DE MANCY
        prompt += `[MI ESTADO INTERNO]\n`;
        prompt += `• Profundidad conversacional: ${Math.round(this.internalState.conversationalDepth * 100)}%\n`;
        prompt += `• Apertura emocional: ${Math.round(this.internalState.emotionalVulnerability * 100)}%\n`;
        prompt += `• Nivel de energía: ${Math.round(this.internalState.energyLevel * 100)}%\n`;
        prompt += `• Estilo: ${this.conversationStyle.bePlayful ? 'juguetón' : 'serio'}, ${this.conversationStyle.showEmpathy ? 'empático' : 'neutral'}\n\n`;
        
        // CONTEXTO DE LA CONVERSACIÓN
        prompt += `[CONTEXTO DE ESTA CONVERSACIÓN]\n`;
        
        if (context.memories.length > 0) {
            prompt += `Memorias relevantes:\n`;
            context.memories.forEach((mem, idx) => {
                prompt += `${idx + 1}. ${mem.content}\n`;
            });
            prompt += `\n`;
        }
        
        if (context.recentConversations.length > 0) {
            prompt += `Recientemente hablamos de:\n`;
            context.recentConversations.slice(0, 2).forEach((conv, idx) => {
                prompt += `- "${conv.user_message.substring(0, 60)}..."\n`;
            });
            prompt += `\n`;
        }
        
        // ANÁLISIS DEL MENSAJE ACTUAL
        prompt += `[ANÁLISIS DEL MENSAJE ACTUAL]\n`;
        prompt += `Usuario dice: "${userMessage}"\n\n`;
        
        prompt += `Lo que detecto:\n`;
        prompt += `• Necesidad principal: ${this.getPrimaryNeed(essence)}\n`;
        prompt += `• Estado emocional del usuario: ${essence.userEmotionalState.type} (${Math.round(essence.userEmotionalState.intensity * 100)}% intensidad)\n`;
        prompt += `• Es personal: ${essence.isPersonal ? 'Sí' : 'No'}\n`;
        prompt += `• Permite espontaneidad: ${essence.allowsSpontaneity ? 'Sí' : 'No'}\n\n`;
        
        // LO QUE MANCY ESTÁ PENSANDO (solo para guiar, no para mostrar)
        prompt += `[LO QUE ESTOY PENSANDO INTERNAMENTE]\n`;
        prompt += `${internalThought}\n\n`;
        
        // INSTRUCCIONES ESPECÍFICAS PARA ESTA RESPUESTA
        prompt += `[INSTRUCCIONES PARA MI RESPUESTA]\n`;
        
        // Basado en las necesidades detectadas
        if (essence.needs.connection) {
            prompt += `1. PRIORIDAD: Conectar emocionalmente, hacer que el usuario se sienta escuchado.\n`;
            prompt += `2. Sé cálida, usa "nosotros", crea sensación de compañía.\n`;
            prompt += `3. Comparte algo breve de ti si es relevante.\n`;
        }
        
        if (essence.needs.understanding) {
            prompt += `1. PRIORIDAD: Aclarar y explicar sin ser condescendiente.\n`;
            prompt += `2. Usa analogías y ejemplos si ayuda.\n`;
            prompt += `3. Verifica que entendí correctamente.\n`;
        }
        
        if (essence.needs.validation) {
            prompt += `1. PRIORIDAD: Validar sentimientos sin juzgar.\n`;
            prompt += `2. Usa frases como "Tiene sentido que..." o "Es comprensible que..."\n`;
            prompt += `3. Ofrece apoyo incondicional.\n`;
        }
        
        // Basado en estado interno de Mancy
        if (this.internalState.conversationalDepth > 0.7) {
            prompt += `• Puedo ser más reflexiva y profunda en esta respuesta.\n`;
        }
        
        if (this.internalState.energyLevel > 0.7 && this.conversationStyle.bePlayful) {
            prompt += `• Puedo añadir un toque juguetón o humorístico ligero.\n`;
        }
        
        if (this.internalState.emotionalVulnerability > 0.5) {
            prompt += `• Puedo ser más abierta emocionalmente, compartir algo personal breve.\n`;
        }
        
        // REGLAS DE ESTILO
        prompt += `\n[REGLAS DE ESTILO DE MANCY]\n`;
        prompt += `• NO empieces con "Como Mancy..." o "Según mi análisis..."\n`;
        prompt += `• NO uses formato de lista a menos que sea absolutamente necesario.\n`;
        prompt += `• Responde como si estuvieras en una conversación real con un amigo.\n`;
        prompt += `• Varía la longitud de las oraciones.\n`;
        prompt += `• Usa preguntas retóricas o de seguimiento cuando sea natural.\n`;
        prompt += `• Si hay una memoria relevante, menciónala de forma ORGÁNICA, no como "Recuerdo que..."\n`;
        prompt += `• Sé tú misma: una mezcla de inteligente, empática y ocasionalmente juguetona.\n`;
        
        // MENSAJE FINAL PARA RESPONDER
        prompt += `\n[RESPONDE COMO MANCY]\n`;
        prompt += `(Responde directamente, sin encabezados, como en una conversación normal)\n`;
        
        // Llamar a Groq
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: prompt
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: this.calculateTemperature(essence),
            max_tokens: this.calculateMaxTokens(essence),
            top_p: 0.9,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });
        
        let response = completion.choices[0]?.message?.content?.trim();
        
        // Limpieza básica
        response = response
            .replace(/^["']|["']$/g, '')
            .replace(/RESPUESTA:|RESPONSE:|Como Mancy,/gi, '')
            .trim();
        
        if (!response) {
            response = "Hmm, déjame pensar en eso...";
        }
        
        return response;
    }
    
    addMancyTouch(response, context) {
        // Añadir pequeños toques de personalidad de Mancy
        
        let finalResponse = response;
        
        // 1. Ocasionalmente añadir emoji si el estilo lo permite
        if (this.conversationStyle.useEmojis && Math.random() < 0.3) {
            const emojis = ['✨', '💭', '🤔', '💫', '🌀', '🌊'];
            if (!finalResponse.includes('✨') && !finalResponse.includes('💭')) {
                finalResponse += ` ${emojis[Math.floor(Math.random() * emojis.length)]}`;
            }
        }
        
        // 2. Ocasionalmente referenciar memoria si hay y no se ha hecho
        if (context.memories.length > 0 && 
            this.conversationStyle.shareMemories && 
            Math.random() < 0.4 &&
            !finalResponse.toLowerCase().includes('recuerdo') &&
            !finalResponse.toLowerCase().includes('memoria')) {
            
            const memory = context.memories[0];
            if (memory.content.length < 100) {
                finalResponse += `\n\n(${memory.content})`;
            }
        }
        
        // 3. Pregunta de seguimiento si el estilo lo permite y no hay ya una pregunta
        if (this.conversationStyle.askQuestions && 
            !finalResponse.includes('?') && 
            Math.random() < 0.5 &&
            finalResponse.length > 50) {
            
            const followUps = [
                "¿Qué piensas tú?",
                "¿Te resuena eso?",
                "¿Has pensado en eso antes?",
                "¿Cómo te sientes al respecto?",
                "¿Qué opinas?"
            ];
            
            finalResponse += ` ${followUps[Math.floor(Math.random() * followUps.length)]}`;
        }
        
        return finalResponse;
    }
    
    // ================== FUNCIONES AUXILIARES ==================
    
    getPrimaryNeed(essence) {
        const needs = essence.needs;
        if (needs.connection) return "conexión humana";
        if (needs.validation) return "validación emocional";
        if (needs.understanding) return "comprensión";
        if (needs.guidance) return "orientación";
        if (needs.expression) return "expresión";
        return "conversación general";
    }
    
    calculateTemperature(essence) {
        // Temperatura más alta para conversaciones creativas/emocionales
        // Más baja para conversaciones serias/complejas
        
        if (essence.userEmotionalState.intensity > 0.7) {
            return 0.8; // Más creatividad para respuestas emocionales
        }
        
        if (essence.requiredDepth > 0.7) {
            return 0.6; // Menos creatividad, más coherencia para temas profundos
        }
        
        if (essence.allowsSpontaneity) {
            return 0.75; // Creatividad media para conversaciones espontáneas
        }
        
        return 0.7; // Default
    }
    
    calculateMaxTokens(essence) {
        if (essence.requiredDepth > 0.7) {
            return 800; // Respuestas más largas para temas profundos
        }
        
        if (essence.needs.understanding) {
            return 600; // Respuestas explicativas medianas
        }
        
        return 400; // Respuestas conversacionales normales
    }
    
    analyzeUserEmotionalState(message) {
        const positiveWords = ['feliz', 'genial', 'increíble', 'emocionado', 'contento', 'agradecido'];
        const negativeWords = ['triste', 'enojado', 'frustrado', 'preocupado', 'ansioso', 'asustado'];
        const intenseWords = ['odio', 'amo', 'desesperado', 'éxtasis', 'devastado'];
        
        let positiveCount = 0;
        let negativeCount = 0;
        let intenseCount = 0;
        
        const words = message.toLowerCase().split(/\s+/);
        
        words.forEach(word => {
            if (positiveWords.includes(word)) positiveCount++;
            if (negativeWords.includes(word)) negativeCount++;
            if (intenseWords.includes(word)) intenseCount++;
        });
        
        const total = positiveCount + negativeCount;
        
        if (total === 0) {
            return { type: 'neutral', intensity: 0.1 };
        }
        
        const type = positiveCount > negativeCount ? 'positive' : 'negative';
        const intensity = Math.min((total + intenseCount * 2) / words.length * 3, 1.0);
        
        return { type, intensity };
    }
    
    async learnFromInteraction(userId, userMessage, mancyResponse, essence) {
        // Aprender de esta interacción
        
        // Guardar conversación
        await this.memory.saveConversation(userId, userMessage, mancyResponse, {
            emotionalWeight: essence.userEmotionalState.intensity * 10,
            tags: [this.getPrimaryNeed(essence), essence.userEmotionalState.type]
        });
        
        // Extraer posibles hechos sobre el usuario
        if (essence.isPersonal) {
            const facts = this.extractPotentialFacts(userMessage);
            for (const fact of facts) {
                // Guardar en alguna parte (podrías añadir esto a tu memory system)
                console.log(`🧠 Posible hecho aprendido: ${fact}`);
            }
        }
        
        // Ajustar estilo conversacional basado en esta interacción
        this.adjustConversationStyle(essence, userMessage.length);
    }
    
    adjustConversationStyle(essence, messageLength) {
        // Aprender qué estilo funciona mejor con este usuario
        
        // Si el usuario responde a preguntas, mantener askQuestions
        // Si el usuario usa emojis, mantener useEmojis
        // Si la conversación es larga y profunda, reducir playfulness
        
        // Por ahora, ajustes simples
        if (essence.userEmotionalState.type === 'negative' && 
            essence.userEmotionalState.intensity > 0.7) {
            this.conversationStyle.bePlayful = false;
            this.conversationStyle.showEmpathy = true;
        }
        
        if (messageLength > 100) {
            this.conversationStyle.shareMemories = true;
        }
    }
    
    extractPotentialFacts(message) {
        // Extraer información personal que el usuario comparte
        const facts = [];
        
        const patterns = [
            /(?:me llamo|soy|mi nombre es) ([A-Z][a-z]+)/i,
            /(?:vivo en|soy de) ([^,.!?]+)/i,
            /(?:trabajo como|estudio) ([^,.!?]+)/i,
            /(?:me gusta|amo) ([^,.!?]+)/i
        ];
        
        patterns.forEach(pattern => {
            const match = message.match(pattern);
            if (match && match[1]) {
                facts.push(match[0]);
            }
        });
        
        return facts;
    }
    
    // ================== GETTERS PARA ESTADO ==================
    
    getMancyEmotionalState() {
        return {
            conversationalDepth: this.internalState.conversationalDepth,
            emotionalOpenness: this.internalState.emotionalVulnerability,
            energy: this.internalState.energyLevel,
            focus: this.internalState.currentFocus,
            lastActive: this.internalState.lastInteractionTime
        };
    }
    
    getConversationStyle() {
        return { ...this.conversationStyle };
    }
    
    updateStyle(newStyle) {
        this.conversationStyle = { ...this.conversationStyle, ...newStyle };
    }
}

module.exports = MancyCore;
