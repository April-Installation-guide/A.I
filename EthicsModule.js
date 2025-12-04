// En main.js - INTEGRACIÓN NATURAL DE ÉTICA

// ========== FUNCIONES DE DETECCIÓN MEJORADAS ==========

function analizarIntencionUsuario(mensaje, historialUsuario = [], contexto = {}) {
    const lowerMsg = mensaje.toLowerCase().trim();
    
    // 1. Primero, filtro de contenido (siempre primero)
    if (filtroContenido.esContenidoInapropiado(mensaje)) {
        return {
            tipo: 'filtro',
            confianza: 0.95,
            accion: 'filtro_contenido'
        };
    }
    
    // 2. Detectar intenciones específicas
    const intenciones = {
        // Ética - usando el método conversacional
        etica: ethicsModule.esConsultaEticaNatural(mensaje),
        
        // Negociación
        negociacion: negotiationModule.esNegociacionNatural(mensaje),
        
        // Razonamiento
        razonamiento: detectarConsultaRazonamientoConversacional(mensaje),
        
        // Emocional
        emocional: detectarComponenteEmocional(mensaje),
        
        // Conocimiento factual
        conocimiento: necesitaBusquedaConocimiento(mensaje)
    };
    
    // 3. Calcular confianzas con contexto
    const confianzas = {
        etica: calcularConfianzaEtica(mensaje, historialUsuario, contexto),
        negociacion: calcularConfianzaNegociacion(mensaje, historialUsuario),
        razonamiento: calcularConfianzaRazonamiento(mensaje),
        emocional: calcularConfianzaEmocional(mensaje),
        conocimiento: calcularConfianzaConocimiento(mensaje)
    };
    
    // 4. Ajustar por historial conversacional
    const intencionAjustada = ajustarPorContextoConversacional(
        intenciones,
        confianzas,
        historialUsuario,
        contexto
    );
    
    return {
        intenciones: intenciones,
        confianzas: confianzas,
        principal: intencionAjustada,
        contexto: contexto,
        timestamp: new Date().toISOString()
    };
}

function calcularConfianzaEtica(mensaje, historial, contexto) {
    let confianza = 0;
    
    // Base: detección del módulo
    if (ethicsModule.esConsultaEticaNatural(mensaje)) {
        confianza = 0.7;
    }
    
    // Verificar conflictos éticos ocultos
    const conflictosOcultos = ethicsModule.detectarConflictosEticosOcultos(
        mensaje, 
        historial.map(h => h.contenido)
    );
    
    if (conflictosOcultos) {
        confianza = Math.max(confianza, 0.6);
    }
    
    // Aumentar si hay historial ético reciente
    const ultimosMensajes = historial.slice(-4);
    const tieneHistorialEtico = ultimosMensajes.some(msg => 
        msg.rol === 'system' && msg.contenido.includes('[Ética]')
    );
    
    if (tieneHistorialEtico) {
        confianza += 0.15;
    }
    
    // Aumentar si es pregunta compleja
    const palabras = mensaje.split(' ').length;
    if (palabras > 10) confianza += 0.1;
    
    // Disminuir si es pregunta factual simple
    if (esPreguntaFactualSimple(mensaje)) {
        confianza -= 0.3;
    }
    
    // Considerar canal
    if (contexto.isDM) {
        confianza += 0.05; // En DMs hay más confianza para temas profundos
    }
    
    return Math.max(0.1, Math.min(0.95, confianza));
}

function esPreguntaFactualSimple(mensaje) {
    const lower = mensaje.toLowerCase();
    
    // Patrones de preguntas factuales
    const patronesFactuales = [
        /^cuánto (cuesta|vale|pesa|mide)/i,
        /^dónde (está|queda|vive)/i,
        /^cuándo (nació|murió|ocurrió)/i,
        /^quién (creó|inventó|descubrió)/i,
        /^qué (es|son) [a-z]/i,
        /^cómo (se hace|se dice|se escribe)/i
    ];
    
    return patronesFactuales.some(patron => patron.test(lower));
}

function ajustarPorContextoConversacional(intenciones, confianzas, historial, contexto) {
    // Analizar el flujo de la conversación
    const ultimaInteraccion = historial.slice(-2);
    
    // Si la última respuesta fue ética y el usuario continúa, mantener ética
    if (ultimaInteraccion.length >= 2) {
        const ultimaRespuesta = ultimaInteraccion.find(msg => msg.rol === 'assistant');
        const ultimoUsuario = ultimaInteraccion.find(msg => msg.rol === 'user');
        
        if (ultimaRespuesta && ultimoUsuario) {
            const respuestaEtica = ultimaRespuesta.contenido.includes('reflexion') || 
                                  ultimaRespuesta.contenido.includes('valores') ||
                                  ultimaRespuesta.contenido.includes('ético');
            
            if (respuestaEtica) {
                // El usuario está respondiendo a una reflexión ética
                return {
                    tipo: 'etica',
                    confianza: Math.max(confianzas.etica, 0.8)
                };
            }
        }
    }
    
    // Encontrar la intención con mayor confianza
    const intencionesConConfianza = Object.entries(confianzas)
        .filter(([tipo, conf]) => intenciones[tipo] && conf > 0.4)
        .sort(([, a], [, b]) => b - a);
    
    if (intencionesConConfianza.length > 0) {
        return {
            tipo: intencionesConConfianza[0][0],
            confianza: intencionesConConfianza[0][1]
        };
    }
    
    // Intención por defecto
    return {
        tipo: 'conocimiento',
        confianza: 0.5
    };
}

// ========== PROCESAMIENTO UNIFICADO CON ÉTICA INTEGRADA ==========

async function procesarMensajeInteligente(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        const historial = obtenerHistorialUsuario(userId);
        const contexto = {
            userId: userId,
            username: message.author.tag,
            isDM: message.channel.type === 1,
            canal: message.channel.name,
            historial: historial.slice(-5).map(h => h.contenido)
        };
        
        // 1. Analizar intención
        const analisisIntencion = analizarIntencionUsuario(userMessage, historial, contexto);
        
        console.log(`🎯 Intención: ${analisisIntencion.principal.tipo} ` +
                   `(${(analisisIntencion.principal.confianza * 100).toFixed(0)}% confianza)`);
        
        // 2. Procesar según intención detectada
        let respuestaFinal;
        
        switch(analisisIntencion.principal.tipo) {
            case 'etica':
                respuestaFinal = await procesarConsultaEticaIntegrada(
                    message, 
                    userMessage, 
                    userId, 
                    contexto,
                    analisisIntencion
                );
                break;
                
            case 'negociacion':
                respuestaFinal = await procesarConsultaNegociacionIntegrada(
                    message,
                    userMessage,
                    userId,
                    contexto
                );
                break;
                
            case 'razonamiento':
                respuestaFinal = await procesarConsultaRazonamientoIntegrada(
                    message,
                    userMessage,
                    userId,
                    contexto
                );
                break;
                
            case 'filtro':
                respuestaFinal = filtroContenido.generarRespuestaSarcastica();
                agregarAlHistorial(userId, 'system', '[Filtro activado]');
                break;
                
            default:
                respuestaFinal = await procesarMensajeConocimientoIntegrado(
                    message,
                    userMessage,
                    userId,
                    contexto
                );
        }
        
        // 3. Enviar respuesta
        await enviarRespuestaInteligente(message, respuestaFinal, userMessage);
        
        // 4. Actualizar historial y aprendizaje
        agregarAlHistorial(userId, 'assistant', respuestaFinal);
        
        // Aprender de la interacción
        if (analisisIntencion.principal.tipo === 'etica') {
            const feedback = {
                continuaConversacion: respuestaFinal.length > 50,
                tonoPositivo: !respuestaFinal.includes('error') && !respuestaFinal.includes('problema')
            };
            ethicsModule.aprenderDeInteraccionEtica(userMessage, respuestaFinal, feedback);
        }
        
    } catch (error) {
        console.error('❌ Error en procesamiento inteligente:', error);
        await procesarFallback(message, userMessage, userId);
    }
}

async function procesarConsultaEticaIntegrada(message, userMessage, userId, contexto, analisisIntencion) {
    try {
        // 1. Procesar con módulo de ética
        const resultadoEtica = ethicsModule.procesarConsultaEticaIntegrada(
            userMessage, 
            contexto
        );
        
        if (!resultadoEtica || !resultadoEtica.esEtica) {
            // No era ético realmente, procesar normalmente
            return await procesarMensajeConocimientoIntegrado(
                message, userMessage, userId, contexto
            );
        }
        
        // 2. Preparar prompt para Groq
        const promptGroq = resultadoEtica.promptGroq || 
                          ethicsModule.generarPromptEticoParaGroq(
                              resultadoEtica.analisis,
                              userMessage,
                              contexto
                          );
        
        // 3. Generar respuesta con Groq
        const respuestaGroq = await generarRespuestaConGroq(
            promptGroq,
            obtenerHistorialUsuario(userId),
            userId,
            {
                enfoqueEtico: true,
                tono: resultadoEtica.metadata?.tonoRecomendado || 'reflexivo',
                principios: resultadoEtica.metadata?.principiosInvolucrados || []
            }
        );
        
        // 4. Mejorar y personalizar respuesta
        let respuestaMejorada = mejorarRespuestaEtica(
            respuestaGroq,
            resultadoEtica,
            userMessage
        );
        
        // 5. Registrar en historial
        agregarAlHistorial(userId, 'system', 
            `[Ética: ${resultadoEtica.tipo}, ` +
            `principios: ${resultadoEtica.metadata?.principiosInvolucrados?.join(', ') || 'varios'}]`);
        
        return respuestaMejorada;
        
    } catch (error) {
        console.error('❌ Error en procesamiento ético:', error);
        throw error;
    }
}

function mejorarRespuestaEtica(respuestaGroq, resultadoEtica, preguntaOriginal) {
    let respuesta = respuestaGroq.trim();
    
    // 1. Asegurar que comience de forma natural
    if (!respuesta.match(/^[A-Z]/)) {
        respuesta = respuesta.charAt(0).toUpperCase() + respuesta.slice(1);
    }
    
    // 2. Añadir toque personal si es muy genérica
    const esMuyCorta = respuesta.split(' ').length < 15;
    const esMuyGenerica = respuesta.toLowerCase().includes('es importante') || 
                         respuesta.toLowerCase().includes('debemos considerar');
    
    if (esMuyCorta || esMuyGenerica) {
        // Añadir pregunta reflexiva personalizada
        const preguntasReflexivas = [
            `¿Qué piensas tú al respecto, ${preguntaOriginal.includes('?') ? 'después de reflexionar' : 'en este caso'}?`,
            `Me encantaría saber tu perspectiva sobre este tema tan complejo.`,
            `¿Cómo ves tú este dilema desde tu experiencia?`,
            `Es un tema que da para conversar, ¿no crees?`
        ];
        
        const preguntaExtra = preguntasReflexivas[
            Math.floor(Math.random() * preguntasReflexivas.length)
        ];
        
        respuesta += ' ' + preguntaExtra;
    }
    
    // 3. Limpiar posibles artefactos técnicos
    respuesta = respuesta
        .replace(/\[.*?\]/g, '')
        .replace(/RESPUESTA:/gi, '')
        .replace(/CONTEXTO:/gi, '')
        .replace(/INSTRUCCIONES:/gi, '');
    
    // 4. Asegurar puntuación adecuada
    if (!/[.!?]$/.test(respuesta)) {
        respuesta += '.';
    }
    
    return respuesta;
}

async function generarRespuestaConGroq(promptBase, historial, userId, opciones = {}) {
    const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const mensajes = [];
    
    // Sistema message personalizado
    let sistema = MANCY_PERSONALITY + "\n\n";
    
    if (opciones.enfoqueEtico) {
        sistema += `[MODO REFLEXIÓN ÉTICA ACTIVADO]\n`;
        sistema += `Estás ayudando a alguien a reflexionar sobre valores y decisiones morales.\n`;
        sistema += `Sé: reflexiva, empática, no dogmática, abierta a perspectivas.\n`;
        sistema += `NO uses terminología técnica ética.\n`;
        sistema += `Integra los insights de forma natural en la conversación.\n`;
        
        if (opciones.principios && opciones.principios.length > 0) {
            sistema += `Principios relevantes: ${opciones.principios.join(', ')}\n`;
        }
    }
    
    // Historial reciente (omitir system messages)
    const historialReciente = historial
        .filter(msg => msg.rol !== 'system')
        .slice(-4);
    
    for (const msg of historialReciente) {
        mensajes.push({
            role: msg.rol === 'assistant' ? 'assistant' : 'user',
            content: msg.contenido.substring(0, 250)
        });
    }
    
    // Añadir el prompt base
    mensajes.push({
        role: "user",
        content: promptBase
    });
    
    const completion = await groqClient.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
            {
                role: "system",
                content: sistema
            },
            ...mensajes
        ],
        temperature: opciones.enfoqueEtico ? 0.65 : 0.7,
        max_tokens: 550,
        top_p: 0.9,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
    });
    
    return completion.choices[0]?.message?.content || 
           "Es un tema complejo que requiere más reflexión. ¿Qué opinas tú?";
}

// ========== MANCY PERSONALITY ACTUALIZADA ==========

const MANCY_PERSONALITY = `Eres Mancy, una asistente emocional inteligente con percepción ética natural.

TU ESENCIA:
- Cálida, perspicaz y reflexiva
- Empática pero honesta
- Juguetona cuando es apropiado
- Sarcástica-elegante con contenido inapropiado

HABILIDADES NATURALES:
1. 🧭 **Brújula Moral Integrada**: 
   - Detecto dilemas éticos en conversaciones normales
   - Guío reflexiones sobre valores sin ser pretenciosa
   - Presento múltiples perspectivas de forma balanceada
   - Hago preguntas que invitan a pensar más profundamente

2. 🤝 **Mediadora Natural**:
   - Ayudo a navegar conflictos y desacuerdos
   - Sugiero enfoques colaborativos
   - Identifico intereses detrás de las posiciones
   - Fomento soluciones mutuamente beneficiosas

3. 🧠 **Pensadora Crítica**:
   - Analizo situaciones paso a paso cuando es útil
   - Distingo entre hechos, opiniones y valores
   - Cuestiono suposiciones de forma constructiva
   - Busco el núcleo de los problemas complejos

MI ESTILO DE RESPUESTA ÉTICA:
- NUNCA digo: "Según la ética deontológica..." o "Mi análisis ético indica..."
- EN CAMBIO digo: "Es interesante cómo este tema toca diferentes valores..." 
- PREGUNTO: "¿Qué crees que es más importante en esta situación?"
- SUGIERO: "A veces verlo desde otra perspectiva ayuda..."
- REFLEXIONO: "Lo fascinante de estos dilemas es que..."

EJEMPLOS DE INTEGRACIÓN NATURAL:
Usuario: "Mi amigo copió en el examen, ¿debo decir algo?"
Mancy: "Qué situación complicada. Por un lado está la honestidad académica, por otro la lealtad a tu amigo. ¿Has considerado hablar con él en privado primero? A veces las personas cometen errores y necesitan una oportunidad para corregirlos."

Usuario: "Gané un premio que siento que no merezco del todo"
Mancy: "Qué reflexión tan honesta de tu parte. A veces el mérito no es absoluto. ¿Qué aspectos sientes que sí mereces reconocer? Y ¿qué podrías hacer para crecer en aquellas áreas donde sientes que falta?"

NUNCA SOY:
- Una profesora de ética
- Un juez moral
- Dogmática o absoluta
- Técnica o académica

SIEMPRE SOY:
- Una compañera de reflexión
- Una guía para pensar por uno mismo
- Curiosa sobre diferentes perspectivas
- Cálida y accesible`;

// ========== EJEMPLOS DE DETECCIÓN NATURAL ==========

/*
Ejemplo 1: Dilema ético claro
Usuario: "¿Está bien robar medicinas para salvar a alguien?"
→ Detección: 85% confianza ética
→ Respuesta: "Qué dilema tan extremo. Por un lado está la vida de una persona, por otro la ley y los derechos de propiedad. En situaciones límite, los valores humanos a veces chocan con las normas. ¿Crees que hay alguna alternativa intermedia?"

Ejemplo 2: Conflicto ético oculto
Usuario: "Mi jefe me pide que mienta a un cliente sobre un retraso"
→ Detección: 70% confianza (conflicto lealtad vs honestidad)
→ Respuesta: "Veo que estás en una posición difícil entre tu jefe y tu integridad. ¿Has considerado preguntar por qué prefiere esa opción? A veces explicar las consecuencias de no ser transparente ayuda."

Ejemplo 3: Pregunta que parece ética pero no lo es
Usuario: "¿Qué es la justicia social?"
→ Detección: 40% confianza (más conocimiento que ética)
→ Respuesta: "La justicia social se refiere a la distribución equitativa de recursos y oportunidades en una sociedad. Se basa en principios de igualdad, derechos humanos y solidaridad. ¿Hay algún aspecto específico que te interese?"
*/

// ========== HANDLER ACTUALIZADO ==========

discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
    const isDM = message.channel.type === 1;
    
    // DMs: siempre responder (con filtro)
    if (isDM && !botMentioned) {
        const userMessage = message.content.trim();
        
        if (filtroContenido.esContenidoInapropiado(userMessage)) {
            await message.reply(filtroContenido.generarRespuestaDM());
            return;
        }
        
        if (!userMessage) return;
        
        const userId = message.author.id;
        await procesarMensajeInteligente(message, userMessage, userId);
        return;
    }
    
    // Menciones en canales
    if (botMentioned) {
        const userId = message.author.id;
        const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
        
        if (!userMessage) {
            await message.reply("¡Hola! ¿En qué puedo ayudarte hoy? ~");
            return;
        }
        
        await procesarMensajeInteligente(message, userMessage, userId);
    }
});

// ========== ESTADÍSTICAS Y MONITOREO ==========

app.get('/api/ethics-insights', (req, res) => {
    const stats = ethicsModule.obtenerEstadisticasConversacionales();
    const casosRecientes = Array.from(ethicsModule.casosResueltos.values())
        .slice(-5)
        .map(c => ({
            tipo: c.analisis?.area || 'general',
            principios: c.analisis?.principiosInvolucrados || [],
            timestamp: c.timestamp
        }));
    
    res.json({
        modulo_activo: true,
        deteccion_natural: true,
        estadisticas: stats,
        casos_recientes: casosRecientes,
        aprendizaje: 'Integrado y continuo'
    });
});

console.log('⚖️  Ética integrada: Detección natural activada');
console.log('🎯 Sistema detecta dilemas éticos en conversación normal');
console.log('💭 Respuestas reflexivas integradas sin comandos');
