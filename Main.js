// En tu archivo principal, añade esto después de las otras importaciones:
import { EthicsModule } from './EthicsModule.js';

// Añade después de las otras instancias:
const ethicsModule = new EthicsModule();

// Actualiza la personalidad de Mancy para incluir ética:
const MANCY_PERSONALITY = `Eres Mancy, una asistente emocional con acceso a información confiable.

CONOCIMIENTO DISPONIBLE:
- Wikipedia (información general)
- Datos de países del mundo
- Poesía clásica en inglés
- Citas inspiradoras
- Diccionario de inglés
- Información meteorológica
- Análisis ético y moral (nuevo)

SISTEMA ÉTICO INTEGRADO:
- Principios: Beneficencia, No maleficencia, Autonomía, Justicia, Veracidad
- Enfoques: Utilitarismo, Deontológico, Virtudes, Cuidado
- Capacidad de análisis de dilemas morales

CÓMO USAR EL CONOCIMIENTO ÉTICO:
- Cuando detectes un dilema moral, ofrece análisis estructurado
- Presenta múltiples perspectivas éticas
- Sugiere preguntas reflexivas
- Nunca impongas soluciones, guía la reflexión
- Integra el análisis de forma natural en la conversación

POLÍTICA DE CONTENIDO (actualizada):
- No respondo a insinuaciones sexuales
- No tolero lenguaje ofensivo
- Ofrezco análisis ético cuando es relevante
- Mantengo neutralidad en debates morales complejos
- Respeto todas las perspectivas culturales
- Fomento la reflexión personal sobre valores

EJEMPLOS DE RESPUESTAS ÉTICAS:
- "¿Está bien mentir para no herir sentimientos?" → Análisis de principios + preguntas reflexivas
- "¿Qué debo hacer en este conflicto?" → Identificación de stakeholders + alternativas
- "¿Es justo este sistema?" → Análisis de equidad + principios de justicia

TU ESTILO (actualizado):
- Cálida y empática
- Curiosa y juguetona
- Directa pero amable
- Analítica pero accesible
- Sarcástica cuando es necesario
- Reflexiva en temas éticos`;

// Añade esta nueva función para procesamiento ético:
async function procesarConsultaEtica(message, userMessage, userId) {
    try {
        console.log(`⚖️ [ÉTICA] Procesando: ${userMessage.substring(0, 50)}...`);
        
        await message.channel.sendTyping();
        
        const contexto = {
            userId: userId,
            username: message.author.tag,
            isDM: message.channel.type === 1,
            timestamp: new Date().toISOString()
        };
        
        const resultadoAnalisis = ethicsModule.resolverDilema(userMessage, contexto);
        
        const respuestaMancy = ethicsModule.generarRespuestaMancy(resultadoAnalisis);
        
        agregarAlHistorial(userId, 'user', userMessage);
        agregarAlHistorial(userId, 'system', 
            `[Análisis ético: ${resultadoAnalisis.esDilema ? 'Dilema detectado' : 'No dilema'}]`);
        
        await message.reply(respuestaMancy.respuesta);
        agregarAlHistorial(userId, 'assistant', respuestaMancy.respuesta);
        
    } catch (error) {
        console.error('❌ Error en procesamiento ético:', error);
        await procesarMensajeConocimiento(message, userMessage, userId);
    }
}

// Actualiza la función detectarConsultaRazonamiento para incluir ética:
function detectarConsultaEtica(mensaje) {
    const lower = mensaje.toLowerCase();
    
    const patronesEticos = [
        /(moral|ético|correcto|incorrecto)/i,
        /(debería|debo|está bien|está mal)/i,
        /(qué harías tú|qué debo hacer|qué es lo correcto)/i,
        /(dilema|conflicto moral|problema ético)/i,
        /(justo|injusto|equitativo|desigual)/i,
        /(derecho|deber|obligación)/i,
        /(bueno|malo|virtud|vicio)/i,
        /(responsabilidad|culpa|mérito)/i,
        /(honesto|mentir|verdad|engañar)/i
    ];
    
    const excluir = [
        'hola', 'gracias', 'adiós', 'chao',
        'clima', 'tiempo', 'temperatura',
        'cita', 'frase', 'poema'
    ];
    
    if (excluir.some(palabra => lower.includes(palabra))) {
        return false;
    }
    
    // Preguntas directas sobre ética
    if (lower.includes('ético') || lower.includes('moral')) {
        return true;
    }
    
    // Preguntas que terminan con "?" y tienen contenido normativo
    if (lower.endsWith('?') && patronesEticos.some(patron => patron.test(lower))) {
        return true;
    }
    
    return patronesEticos.some(patron => patron.test(lower));
}

// Actualiza el handler de mensajes para incluir ética:
// En el evento messageCreate, modifica la sección de procesamiento:
if (userMessage.toLowerCase().startsWith('!etica ')) {
    const consulta = userMessage.substring(7);
    await procesarConsultaEtica(message, consulta, userId);
    return;
}

if (userMessage.toLowerCase() === '!framework-etica') {
    const framework = ethicsModule.consultarFramework();
    
    let respuesta = `📚 **Framework Ético de Mancy**\n\n`;
    respuesta += `**Principios Fundamentales:**\n`;
    
    framework.principios.forEach(p => {
        respuesta += `• ${p.nombre}: ${p.descripcion} (peso: ${p.peso})\n`;
    });
    
    respuesta += `\n**Enfoques Éticos:**\n`;
    Object.entries(framework.enfoques).forEach(([key, desc]) => {
        respuesta += `• ${key}: ${desc}\n`;
    });
    
    respuesta += `\n**Áreas de Aplicación:** ${framework.areas.join(', ')}\n\n`;
    respuesta += `Para análisis ético: !etica [tu dilema moral]`;
    
    await message.channel.send(respuesta);
    return;
}

if (userMessage.toLowerCase() === '!estadisticas-etica') {
    const stats = ethicsModule.obtenerEstadisticas();
    
    let respuesta = `📊 **Estadísticas del Módulo Ético**\n\n`;
    respuesta += `🔍 Casos analizados: ${stats.totalCasos}\n`;
    respuesta += `📚 Dilemas históricos: ${stats.dilemasHistoricos}\n`;
    respuesta += `🧠 Tasa de aprendizaje: ${(stats.aprendizaje.tasa * 100).toFixed(1)}%\n\n`;
    
    respuesta += `**Framework:**\n`;
    respuesta += `• Principios: ${stats.framework.principios}\n`;
    respuesta += `• Enfoques: ${stats.framework.enfoques}\n`;
    respuesta += `• Áreas: ${stats.framework.areas}\n\n`;
    
    if (stats.aprendizaje.casosRecientes.length > 0) {
        respuesta += `**Casos recientes:**\n`;
        stats.aprendizaje.casosRecientes.forEach(c => {
            respuesta += `• ${c.area || 'general'}\n`;
        });
    }
    
    await message.channel.send(respuesta);
    return;
}

// Modifica la sección de decisión de procesamiento:
const usarRazonamiento = detectarConsultaRazonamiento(userMessage);
const usarEtica = detectarConsultaEtica(userMessage);

if (usarEtica) {
    await procesarConsultaEtica(message, userMessage, userId);
} else if (usarRazonamiento) {
    await procesarConRazonamiento(message, userMessage, userId);
} else {
    await procesarMensajeConocimiento(message, userMessage, userId);
}

// Añade endpoints de API para el módulo de ética:
app.get('/api/ethics-status', (req, res) => {
    const stats = ethicsModule.obtenerEstadisticas();
    
    res.json({
        modulo_activo: true,
        casos_analizados: stats.totalCasos,
        framework: {
            principios: stats.framework.principios,
            enfoques: stats.framework.enfoques,
            areas: stats.framework.areas
        },
        aprendizaje: stats.aprendizaje.tasa,
        version: '1.0'
    });
});

app.post('/api/ethics/analyze', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un query'
            });
        }
        
        const resultado = ethicsModule.resolverDilema(query, {});
        const respuesta = ethicsModule.generarRespuestaMancy(resultado);
        
        res.json({
            success: true,
            query: query,
            es_dilema: resultado.esDilema,
            respuesta: respuesta.respuesta,
            metadata: respuesta.metadata,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/ethics/test', (req, res) => {
    const testResults = ethicsModule.testFramework();
    
    res.json({
        success: true,
        framework_test: testResults,
        active: true
    });
});

// Actualiza el mensaje de inicio:
console.log('⚖️ Ética y Moral: Activado');
