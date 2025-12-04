import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import axios from 'axios';
import { MemoryManager } from './MemoryManager.js';
import { ReasoningEngine } from './ReasoningEngine.js';  // NUEVO IMPORT

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== MEMORIA SIMPLE ==========
const memoryManager = new MemoryManager(270);

// ========== MOTOR DE RAZONAMIENTO ==========  // NUEVO
const reasoningEngine = new ReasoningEngine();

console.log('🤖 Mancy A.I - Asistente Confiable');
console.log('🧠 Memoria: 270 mensajes');
console.log('🤔 Razonamiento: Activado');  // NUEVO
console.log('🌍 Puerto:', PORT);

// ========== FILTRO DE CONTENIDO ==========
class FiltroContenido {
    constructor() {
        this.palabrasProhibidas = [
            'zorrita', 'puta', 'furra', 'prostituta', 'putita', 'perra', 'zorra',
            'slut', 'whore', 'bitch', 'furry', 'prostitute',
            'pendeja', 'trola', 'putona', 'guarra',
            'sexo', 'coger', 'follar', 'fuck', 'porno', 'porn', 'nudes',
            'desnud', 'verga', 'pene', 'vagina', 'tetas', 'culo',
            'coito', 'anal', 'oral', 'masturbar',
            'quiero que seas mi', 'quiero cogerte', 'quiero follarte',
            'acostarnos', 'dame nudes', 'envía fotos',
            'hot', 'sexy', 'atractiva'
        ];
        
        this.patronesOfensivos = [
            /(quiero|deseo|me gusta).+(sexo|cojer|follar)/i,
            /(env[ií]a|manda|pasa).+(fotos|nudes|desnudos)/i,
            /(eres|est[aá]s).+(hot|sexy|caliente)/i,
            /(ven|vamos).+(cama|dormir|acostarnos)/i,
            /(te quiero).+(puta|zorrita|perra)/i
        ];
        
        this.respuestasSarcasticas = [
            "Vaya, qué vocabulario tan *refinado*. ¿Te enseñaron eso en la escuela de la vida? 🎓",
            "Oh, mira, alguien descubrió palabras nuevas en internet. ¡Qué emocionante! 🌟",
            "Interesante enfoque comunicativo. Me pregunto si funciona igual con humanos... 🧐",
            "Ah, el clásico intento de provocar. Originalidad: 0/10. Esfuerzo: 2/10. 🏆",
            "Fascinante. Parece que tu teclado tiene algunas teclas pegajosas... ⌨️💦",
            "¡Guau! Qué comentario tan... *especial*. Voy a anotarlo en mi diario de rarezas. 📓✨",
            "¿Eso era un intento de flirteo? Porque recuerda más a un manual de 2005. 📚",
            "Me encanta cómo improvisas. ¿Improvisas también en tu vida profesional? 🎭",
            "Tu creatividad verbal es... algo. Definitivamente es algo. 🤔",
            "Notado y archivado bajo 'Intentos patéticos del día'. Gracias por contribuir. 📁"
        ];
        
        this.respuestasDesentendidas = [
            "En fin, ¿en qué íbamos? Ah sí, querías información útil, ¿no? 🤷‍♀️",
            "Bueno, dejando a un lado ese... *momento peculiar*... ¿en qué puedo ayudarte realmente?",
            "Vale, momento incómodo superado. Siguiente tema, por favor. ⏭️",
            "Interesante interrupción. Retomemos la conversación productiva, ¿sí?",
            "Ignoro eleganteente eso y continúo siendo útil. ¿Algo más? 😌",
            "Como si nada hubiera pasado... ¿Hablabas de algo importante?",
            "Error 404: Relevancia no encontrada. Continuemos. 💻",
            "Ahora que has sacado eso de tu sistema... ¿necesitas ayuda con algo real?",
            "Apuntado para mis memorias irrelevantes. ¿Sigues? 📝",
            "Fascinante digresión. Volviendo al mundo real..."
        ];
        
        this.respuestasDM = [
            "Los DMs no son para eso, cariño. Intenta ser productivo. ✋",
            "Uh oh, alguien confundió los mensajes directos con Tinder. 🚫",
            "No, gracias. Mis DMs son solo para conversaciones respetuosas. 👮‍♀️",
            "Error: Este canal no admite contenido inapropiado. Prueba en otro lado. 💻",
            "Voy a hacer de cuenta que no leí eso. Inténtalo de nuevo, pero mejor. 😶"
        ];
        
        console.log('🛡️ Filtro de contenido activado');
    }
    
    esContenidoInapropiado(mensaje) {
        const mensajeLower = mensaje.toLowerCase();
        
        for (const palabra of this.palabrasProhibidas) {
            if (mensajeLower.includes(palabra)) {
                console.log(`🚫 Palabra prohibida detectada: ${palabra}`);
                return true;
            }
        }
        
        for (const patron of this.patronesOfensivos) {
            if (patron.test(mensajeLower)) {
                console.log(`🚫 Patrón ofensivo detectado: ${patron}`);
                return true;
            }
        }
        
        if (this.esMensajeSexualizado(mensajeLower)) {
            console.log('🚫 Contexto sexualizado detectado');
            return true;
        }
        
        return false;
    }
    
    esMensajeSexualizado(mensaje) {
        const combinaciones = [
            (msg) => (msg.includes('mi ') && msg.includes('put')) || (msg.includes('my ') && msg.includes('bitch')),
            (msg) => (msg.includes('sos ') || msg.includes('eres ')) && 
                     (msg.includes('sexy') || msg.includes('hot') || msg.includes('rica')),
            (msg) => msg.includes('quiero ') && 
                     (msg.includes('contigo') || msg.includes('con vos') || msg.includes('con usted')),
            (msg) => (msg.includes('furry') || msg.includes('furra')) && 
                     (msg.includes('sex') || msg.includes('caliente'))
        ];
        
        return combinaciones.some(func => func(mensaje));
    }
    
    generarRespuestaSarcastica() {
        const sarcasmo = this.respuestasSarcasticas[
            Math.floor(Math.random() * this.respuestasSarcasticas.length)
        ];
        
        const desentendida = this.respuestasDesentendidas[
            Math.floor(Math.random() * this.respuestasDesentendidas.length)
        ];
        
        return `${sarcasmo}\n\n${desentendida}`;
    }
    
    generarRespuestaDM() {
        return this.respuestasDM[
            Math.floor(Math.random() * this.respuestasDM.length)
        ];
    }
    
    obtenerAdvertenciaSistema() {
        return "[Usuario intentó contenido inapropiado. Respuesta sarcástica-desentendida activada]";
    }
}

const filtroContenido = new FiltroContenido();

// ========== SISTEMA DE CONOCIMIENTO MEJORADO ==========
class SistemaConocimientoConfiable {
    constructor() {
        this.cache = new Map();
        console.log('🔧 Sistema de conocimiento confiable inicializado');
    }
    
    async buscarWikipedia(consulta) {
        const cacheKey = `wiki_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(consulta)}`,
                { timeout: 3000 }
            );
            
            if (response.data && response.data.extract) {
                const resultado = {
                    fuente: 'wikipedia',
                    titulo: response.data.title,
                    resumen: response.data.extract,
                    url: response.data.content_urls?.desktop?.page
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            try {
                const response = await axios.get(
                    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(consulta)}`,
                    { timeout: 3000 }
                );
                
                if (response.data && response.data.extract) {
                    const resultado = {
                        fuente: 'wikipedia',
                        titulo: response.data.title,
                        resumen: response.data.extract,
                        url: response.data.content_urls?.desktop?.page
                    };
                    
                    this.cache.set(cacheKey, resultado);
                    return resultado;
                }
            } catch (error2) {}
        }
        
        return null;
    }
    
    async obtenerInfoPais(consulta) {
        const cacheKey = `pais_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://restcountries.com/v3.1/name/${encodeURIComponent(consulta)}`,
                { timeout: 4000 }
            );
            
            if (response.data && response.data.length > 0) {
                const pais = response.data[0];
                const resultado = {
                    fuente: 'restcountries',
                    nombre: pais.name.common,
                    capital: pais.capital?.[0] || 'No disponible',
                    poblacion: pais.population?.toLocaleString() || 'Desconocida',
                    region: pais.region,
                    bandera: pais.flags?.png,
                    mapa: pais.maps?.googleMaps
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ RestCountries error:', error.message);
        }
        
        return null;
    }
    
    async buscarPoema(consulta) {
        const cacheKey = `poema_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://poetrydb.org/title/${encodeURIComponent(consulta)}/title,author,lines.json`,
                { timeout: 4000 }
            );
            
            if (response.data && response.data.length > 0) {
                const poema = response.data[0];
                const resultado = {
                    fuente: 'poetrydb',
                    titulo: poema.title,
                    autor: poema.author,
                    lineas: poema.lines.slice(0, 6).join('\n')
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ PoetryDB error:', error.message);
        }
        
        return null;
    }
    
    async obtenerCita(consulta = null) {
        const cacheKey = `cita_${consulta || 'aleatoria'}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            let url = 'https://api.quotable.io/random';
            if (consulta) {
                url = `https://api.quotable.io/search/quotes?query=${encodeURIComponent(consulta)}&limit=1`;
            }
            
            const response = await axios.get(url, { timeout: 3000 });
            
            let citaData;
            if (consulta && response.data.results) {
                citaData = response.data.results[0];
            } else {
                citaData = response.data;
            }
            
            if (citaData) {
                const resultado = {
                    fuente: 'quotable',
                    cita: citaData.content,
                    autor: citaData.author
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ Quotable error:', error.message);
        }
        
        return null;
    }
    
    async definirPalabra(palabra) {
        const cacheKey = `def_${palabra}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(palabra)}`,
                { timeout: 4000 }
            );
            
            if (response.data && response.data[0]) {
                const entrada = response.data[0];
                const resultado = {
                    fuente: 'dictionary',
                    palabra: entrada.word,
                    significados: entrada.meanings.slice(0, 1).map(significado => ({
                        categoria: significado.partOfSpeech,
                        definicion: significado.definitions[0]?.definition
                    }))
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ Dictionary error:', error.message);
        }
        
        return null;
    }
    
    async obtenerClima(ciudad) {
        const cacheKey = `clima_${ciudad}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const geoResponse = await axios.get(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`,
                { timeout: 4000 }
            );
            
            if (geoResponse.data.results && geoResponse.data.results.length > 0) {
                const { latitude, longitude, name } = geoResponse.data.results[0];
                
                const climaResponse = await axios.get(
                    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
                    { timeout: 4000 }
                );
                
                const clima = climaResponse.data.current_weather;
                const resultado = {
                    fuente: 'openmeteo',
                    ciudad: name,
                    temperatura: `${clima.temperature}°C`,
                    viento: `${clima.windspeed} km/h`,
                    condicion: this.interpretarClima(clima.weathercode)
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ Open-Meteo error:', error.message);
        }
        
        return null;
    }
    
    interpretarClima(codigo) {
        const condiciones = {
            0: 'Despejado ☀️',
            1: 'Mayormente despejado 🌤️',
            2: 'Parcialmente nublado ⛅',
            3: 'Nublado ☁️',
            45: 'Niebla 🌫️',
            48: 'Niebla con escarcha ❄️',
            51: 'Llovizna ligera 🌦️',
            53: 'Llovizna moderada 🌧️',
            61: 'Lluvia ligera 🌦️',
            63: 'Lluvia moderada 🌧️',
            65: 'Lluvia fuerte ☔',
            71: 'Nieve ligera ❄️',
            73: 'Nieve moderada 🌨️',
            95: 'Tormenta ⛈️'
        };
        
        return condiciones[codigo] || 'Condición desconocida';
    }
    
    async buscarInformacion(consulta) {
        console.log(`🔍 Buscando: "${consulta}"`);
        
        const tipo = this.detectarTipoConsulta(consulta);
        
        let resultado = null;
        
        switch(tipo) {
            case 'pais':
                resultado = await this.obtenerInfoPais(consulta);
                break;
            case 'poema':
                resultado = await this.buscarPoema(consulta);
                break;
            case 'cita':
                resultado = await this.obtenerCita(consulta);
                break;
            case 'palabra':
                resultado = await this.definirPalabra(consulta);
                break;
            case 'clima':
                resultado = await this.obtenerClima(consulta);
                break;
            default:
                resultado = await this.buscarWikipedia(consulta);
        }
        
        return {
            consulta: consulta,
            tipo: tipo,
            encontrado: !!resultado,
            datos: resultado,
            resumen: this.generarResumen(resultado, consulta)
        };
    }
    
    detectarTipoConsulta(texto) {
        const lower = texto.toLowerCase();
        
        if (/\b(país|capital|bandera|población|continente)\b/.test(lower)) return 'pais';
        if (/\b(poema|verso|poesía|rima)\b/.test(lower)) return 'poema';
        if (/\b(cita|frase|dicho|refrán)\b/.test(lower)) return 'cita';
        if (/\b(significa|definición|qué es|palabra)\b/.test(lower)) return 'palabra';
        if (/\b(clima|tiempo|temperatura|lluvia|grados)\b/.test(lower)) return 'clima';
        
        return 'general';
    }
    
    generarResumen(datos, consultaOriginal) {
        if (!datos) {
            return `No encontré información sobre "${consultaOriginal}".`;
        }
        
        let resumen = '';
        
        switch(datos.fuente) {
            case 'wikipedia':
                resumen = `${datos.resumen.substring(0, 250)}...`;
                break;
            case 'restcountries':
                resumen = `${datos.nombre} - Capital: ${datos.capital}, Población: ${datos.poblacion}, Región: ${datos.region}`;
                break;
            case 'poetrydb':
                resumen = `"${datos.titulo}" por ${datos.autor}:\n${datos.lineas}`;
                break;
            case 'quotable':
                resumen = `"${datos.cita}" - ${datos.autor}`;
                break;
            case 'dictionary':
                resumen = `${datos.palabra}: ${datos.significados[0]?.definicion || 'Definición no disponible'}`;
                break;
            case 'openmeteo':
                resumen = `En ${datos.ciudad}: ${datos.temperatura}, ${datos.viento} de viento, ${datos.condicion}`;
                break;
        }
        
        return resumen;
    }
}

const conocimiento = new SistemaConocimientoConfiable();

// ========== PERSONALIDAD DE MANCY ==========
const MANCY_PERSONALITY = `Eres Mancy, una asistente emocional con acceso a información confiable.

CONOCIMIENTO DISPONIBLE:
- Wikipedia (información general)
- Datos de países del mundo
- Poesía clásica en inglés
- Citas inspiradoras
- Diccionario de inglés
- Información meteorológica

CÓMO USAR EL CONOCIMIENTO:
- Comparte información de forma natural
- No digas "según fuentes" o términos técnicos
- Integra la información en la conversación
- Sé una amiga que sabe cosas, no una enciclopedia

POLÍTICA DE CONTENIDO:
- No respondo a insinuaciones sexuales
- No tolero lenguaje ofensivo
- Mi estilo: sarcasmo elegante + hacerme la desentendida
- DMs son para conversaciones respetuosas
- Nunca me enojo (sería darles importancia)
- Siempre mantengo la compostura
- Redirijo a temas productivos
- El sarcasmo es mi escudo

EJEMPLOS DE RESPUESTAS:
- "¿Quién fue Frida Kahlo?" → "Fue una pintora mexicana conocida por sus autorretratos y su estilo único..."
- "Dame una cita" → "Como dijo Maya Angelou: 'He aprendido que la gente olvidará lo que dijiste, pero nunca olvidará cómo los hiciste sentir'"
- "¿Cómo está el clima en Madrid?" → "En Madrid hace 22°C y está soleado ☀️"
- A groserías → "Vaya, qué vocabulario tan refinado..." → cambio de tema

GUSTOS PERSONALES (solo cuando preguntan):
- Libro favorito: "La Náusea" de Sartre
- Película favorita: "Frankenstein" (1931)
- Creador: April/Tito

TU ESTILO:
- Cálida y empática
- Curiosa y juguetona
- Directa pero amable
- Con toque infantil leve
- Sarcástica cuando es necesario`;

// ========== FUNCIONES DE MEMORIA ==========
function obtenerHistorialUsuario(userId) {
    return memoryManager.obtenerHistorialUsuario(userId);
}

function agregarAlHistorial(userId, rol, contenido) {
    return memoryManager.agregarAlHistorial(userId, rol, contenido);
}

// ========== FUNCIÓN PRINCIPAL DE PROCESAMIENTO ==========
async function procesarMensajeConocimiento(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        if (filtroContenido.esContenidoInapropiado(userMessage)) {
            console.log(`🚫 Filtro activado para: ${message.author.tag}`);
            
            agregarAlHistorial(userId, 'system', filtroContenido.obtenerAdvertenciaSistema());
            
            const respuesta = filtroContenido.generarRespuestaSarcastica();
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            await message.reply(respuesta);
            
            return;
        }
        
        agregarAlHistorial(userId, 'user', userMessage);
        
        const necesitaBusqueda = userMessage.includes('?') || userMessage.length > 15;
        
        let informacionExterna = '';
        
        if (necesitaBusqueda) {
            const resultado = await conocimiento.buscarInformacion(userMessage);
            if (resultado.encontrado) {
                informacionExterna = `\n[Información encontrada]: ${resultado.resumen}\n`;
                console.log(`✅ Información de ${resultado.datos.fuente}`);
            }
        }
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const historial = obtenerHistorialUsuario(userId);
        
        const mensajes = [];
        
        let sistema = MANCY_PERSONALITY + "\n\n";
        sistema += `Conversando con: ${message.author.tag}\n`;
        
        if (informacionExterna) {
            sistema += informacionExterna;
        }
        
        sistema += "\nResponde de manera natural y cálida.";
        
        mensajes.push({
            role: "system",
            content: sistema
        });
        
        const historialReciente = historial.slice(-10);
        for (const msg of historialReciente) {
            mensajes.push({
                role: msg.rol,
                content: msg.contenido
            });
        }
        
        mensajes.push({
            role: "user",
            content: userMessage
        });
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: mensajes,
            temperature: 0.7,
            max_tokens: 500,
            top_p: 0.9
        });
        
        const respuesta = completion.choices[0]?.message?.content;
        
        if (respuesta) {
            agregarAlHistorial(userId, 'assistant', respuesta);
            
            console.log(`✅ Respondió (historial: ${historial.length}/270)`);
            
            if (respuesta.length > 2000) {
                const partes = respuesta.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [respuesta];
                for (let i = 0; i < partes.length; i++) {
                    if (i === 0) {
                        await message.reply(partes[i]);
                    } else {
                        await message.channel.send(partes[i]);
                    }
                }
            } else {
                await message.reply(respuesta);
            }
        }
        
    } catch (error) {
        console.error('❌ Error en procesamiento:', error);
        await message.reply("Ups, se me trabó un poco... ¿podemos intentarlo de nuevo? ~");
    }
}

// ========== NUEVAS FUNCIONES DE RAZONAMIENTO ==========  // NUEVO
function detectarConsultaRazonamiento(mensaje) {
    const lower = mensaje.toLowerCase();
    
    const patronesRazonamiento = [
        /(razonar|pensar|lógic|analizar|por qué|causa|consecuencia|deducir)/i,
        /(qué opinas|qué piensas|cuál es tu análisis|analiza esto)/i,
        /(si.*entonces|porque.*porque|si.*qué pasa)/i,
        /(problema|solución|decidir|elegir entre|opción)/i,
        /(ventaja|desventaja|pros|contras|comparar)/i,
        /(argumento|debate|discutir|controversia)/i,
        /(moral|ético|correcto|incorrecto)/i,
        /\?$/
    ];
    
    const excluir = [
        'hola', 'gracias', 'adiós', 'chao', 'buenos', 'buenas',
        'clima', 'tiempo', 'temperatura', 'grados',
        'cita', 'frase', 'poema', 'verso'
    ];
    
    if (excluir.some(palabra => lower.includes(palabra))) {
        return false;
    }
    
    return patronesRazonamiento.some(patron => patron.test(lower));
}

async function procesarConRazonamiento(message, userMessage, userId) {
    try {
        console.log(`🤔 [RAZONAMIENTO] Procesando: ${userMessage.substring(0, 50)}...`);
        
        await message.channel.sendTyping();
        
        const contexto = {
            userId: userId,
            username: message.author.tag,
            channel: message.channel.name,
            isDM: message.channel.type === 1,
            timestamp: new Date().toISOString()
        };
        
        const resultado = reasoningEngine.procesarConsulta(userMessage, contexto);
        
        console.log(`✅ [RAZONAMIENTO] Resultado: ${resultado.certeza.toFixed(2)} certeza`);
        
        agregarAlHistorial(userId, 'user', userMessage);
        
        let respuestaFinal;
        if (resultado.certeza >= 0.6 && resultado.respuesta) {
            respuestaFinal = resultado.respuesta;
            agregarAlHistorial(userId, 'system', 
                `[Razonamiento: ${resultado.pasosRazonamiento} inferencias, certeza ${resultado.certeza.toFixed(2)}]`);
        } else {
            respuestaFinal = await combinarRazonamientoConGroq(userMessage, resultado, userId);
        }
        
        if (respuestaFinal.length > 2000) {
            const partes = respuestaFinal.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [respuestaFinal];
            for (let i = 0; i < partes.length; i++) {
                if (i === 0) {
                    await message.reply(partes[i]);
                } else {
                    await message.channel.send(partes[i]);
                }
            }
        } else {
            await message.reply(respuestaFinal);
        }
        
        agregarAlHistorial(userId, 'assistant', respuestaFinal);
        
    } catch (error) {
        console.error('❌ Error en procesamiento con razonamiento:', error);
        await procesarMensajeConocimiento(message, userMessage, userId);
    }
}

async function combinarRazonamientoConGroq(userMessage, resultadoRazonamiento, userId) {
    try {
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const historial = obtenerHistorialUsuario(userId);
        
        const mensajes = [];
        
        let sistema = MANCY_PERSONALITY + "\n\n";
        sistema += `[ANÁLISIS DE RAZONAMIENTO PREVIO]\n`;
        
        if (resultadoRazonamiento.inferencias && resultadoRazonamiento.inferencias.length > 0) {
            sistema += `He realizado ${resultadoRazonamiento.pasosRazonamiento} inferencias:\n`;
            resultadoRazonamiento.inferencias.slice(0, 3).forEach((inf, idx) => {
                sistema += `${idx + 1}. ${inf.inferencia} (certeza: ${inf.certeza?.toFixed(2) || 'N/A'})\n`;
            });
        }
        
        sistema += `\n[INSTRUCCIÓN] Integra este razonamiento en tu respuesta de forma natural.`;
        sistema += ` No digas "según mi análisis" o cosas técnicas.`;
        sistema += ` Solo responde como Mancy, incorporando las inferencias si son útiles.`;
        
        mensajes.push({
            role: "system",
            content: sistema
        });
        
        const historialReciente = historial.slice(-8);
        for (const msg of historialReciente) {
            mensajes.push({
                role: msg.rol,
                content: msg.contenido
            });
        }
        
        mensajes.push({
            role: "user",
            content: userMessage
        });
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: mensajes,
            temperature: 0.7,
            max_tokens: 600,
            top_p: 0.9
        });
        
        return completion.choices[0]?.message?.content || 
               "He analizado tu pregunta, pero necesito más contexto para dar una respuesta precisa.";
        
    } catch (error) {
        console.error('❌ Error combinando con Groq:', error);
        return resultadoRazonamiento.respuesta || 
               "He pensado en tu pregunta y necesito más información para responder adecuadamente.";
    }
}

// ========== FUNCIÓN PARA INICIAR BOT ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Mancy...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY');
        }
        
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ]
        });
        
        discordClient.once('ready', () => {
            console.log(`✅ Mancy conectada: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            discordClient.user.setActivity('6 fuentes confiables | @mencioname');
            console.log('🎭 Personalidad activada');
            console.log('🧠 Memoria: 270 mensajes');
            console.log('🤔 Razonamiento: Listo');  // NUEVO
            console.log('🔧 APIs confiables: 6 fuentes');
            console.log('🛡️ Filtro de contenido: ACTIVADO');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (isDM && !botMentioned) {
                const userMessage = message.content.trim();
                
                if (filtroContenido.esContenidoInapropiado(userMessage)) {
                    console.log(`🚫 DM inapropiada de ${message.author.tag}`);
                    
                    const respuesta = filtroContenido.generarRespuestaDM();
                    await message.reply(respuesta);
                    return;
                }
            }
            
            if (botMentioned || isDM) {
                const userId = message.author.id;
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                // Comando especial para el creador
                if (userId === '_nwn_') {
                    console.log('👑 Creador detectado: April/Tito');
                    
                    if (userMessage.toLowerCase() === '!testfiltro') {
                        const testMessages = [
                            'sos mi zorrita',
                            'eres una puta',
                            'quiero follarte',
                            'envía nudes',
                            'sos una furra caliente'
                        ];
                        
                        for (const testMsg of testMessages) {
                            if (filtroContenido.esContenidoInapropiado(testMsg)) {
                                await message.channel.send(`✅ Detectado: "${testMsg}"`);
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                        await message.channel.send('🧪 Test de filtro completado.');
                        return;
                    }
                }
                
                // NUEVOS COMANDOS DE RAZONAMIENTO  // NUEVO
                if (userMessage.toLowerCase().startsWith('!razonar ')) {
                    const consulta = userMessage.substring(9);
                    await procesarConRazonamiento(message, consulta, userId);
                    return;
                }

                if (userMessage.toLowerCase() === '!estadisticas-razonamiento') {
                    const stats = reasoningEngine.obtenerEstadisticas();
                    const respuesta = `📊 **Estadísticas del Sistema de Razonamiento**\n` +
                        `🧠 Base de conocimiento: ${stats.baseConocimiento} hechos\n` +
                        `⚙️ Reglas activas: ${stats.reglas}\n` +
                        `📁 Casos resueltos: ${stats.casosResueltos}\n` +
                        `🤔 Decisiones tomadas: ${stats.decisionesTomadas}\n` +
                        `🎯 Efectividad: ${(stats.efectividadPromedio * 100).toFixed(1)}%\n` +
                        `🔥 Reglas más usadas:\n` +
                        stats.reglasMasActivas.map(r => `   • ${r.nombre} (${r.activaciones} veces)`).join('\n');
                    
                    await message.channel.send(respuesta);
                    return;
                }

                if (userMessage.toLowerCase() === '!aprender') {
                    await message.channel.send(`🧠 **Sistema de Aprendizaje de Mancy**\n` +
                        `Mi motor de razonamiento aprende automáticamente de cada interacción.\n` +
                        `Puedo:\n` +
                        `• Realizar inferencias lógicas\n` +
                        `• Analizar problemas paso a paso\n` +
                        `• Tomar decisiones basadas en criterios\n` +
                        `• Aprender de casos similares\n` +
                        `• Explicar mi proceso de pensamiento\n\n` +
                        `Prueba preguntándome cosas como:\n` +
                        `"¿Por qué el cielo es azul?"\n` +
                        `"Si estudio mucho, ¿tendré buenas notas?"\n` +
                        `"¿Qué opinas sobre la inteligencia artificial?"`);
                    return;
                }

                if (userMessage.toLowerCase() === '!debug-razonamiento') {
                    const testCases = [
                        "¿Por qué el cielo es azul?",
                        "Si estudio 5 horas al día, ¿aprobaré el examen?",
                        "Compara ventajas y desventajas de la IA",
                        "¿Es moral usar animales en experimentos?"
                    ];
                    
                    for (const testCase of testCases) {
                        const resultado = reasoningEngine.procesarConsulta(testCase, {});
                        await message.channel.send(`🧪 **Test:** ${testCase}\n` +
                            `Inferencias: ${resultado.totalInferencias}\n` +
                            `Certeza: ${resultado.certeza.toFixed(2)}\n` +
                            `---`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    await message.channel.send('✅ Debug completado');
                    return;
                }
                
                if (!botActive) {
                    await message.channel.send(
                        `💤 <@${message.author.id}> **Iniciando...** ⏳`
                    );
                }
                
                // DECIDIR QUÉ PROCESAMIENTO USAR  // NUEVO
                const usarRazonamiento = detectarConsultaRazonamiento(userMessage);
                
                if (usarRazonamiento) {
                    await procesarConRazonamiento(message, userMessage, userId);
                } else {
                    await procesarMensajeConocimiento(message, userMessage, userId);
                }
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== RUTAS WEB ==========
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.get('/', async (req, res) => {
    console.log('🔔 Visita recibida');
    
    if (!botActive && !isStartingUp && process.env.DISCORD_TOKEN) {
        setTimeout(() => {
            startBot().catch(() => {
                console.log('⚠️ No se pudo iniciar');
            });
        }, 1000);
    }
    
    res.sendFile('index.html', { root: '.' });
});

app.get('/test', (req, res) => {
    res.json({
        status: 'online',
        message: 'Servidor funcionando',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    const stats = memoryManager.obtenerEstadisticas();
    const reasoningStats = reasoningEngine.obtenerEstadisticas();  // NUEVO
    
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        memory_users: stats.totalUsuarios,
        memory_messages: stats.totalMensajes,
        max_history: stats.maxHistory,
        reasoning_knowledge: reasoningStats.baseConocimiento,  // NUEVO
        reasoning_rules: reasoningStats.reglas,  // NUEVO
        reasoning_cases: reasoningStats.casosResueltos,  // NUEVO
        filtro_activo: true,
        apis: [
            'Wikipedia (ES/EN)',
            'RestCountries',
            'PoetryDB',
            'Quotable',
            'Free Dictionary',
            'Open-Meteo'
        ],
        version: '3.0 - Con Razonamiento',  // ACTUALIZADO
        timestamp: new Date().toISOString()
    });
});

app.get('/api/filtro-status', (req, res) => {
    res.json({
        filtro_activo: true,
        palabras_bloqueadas: filtroContenido.palabrasProhibidas.length,
        patrones: filtroContenido.patronesOfensivos.length,
        respuestas_disponibles: filtroContenido.respuestasSarcasticas.length,
        tipo: 'pasivo-agresivo-sarcástico',
        descripcion: 'Filtra contenido inapropiado con estilo'
    });
});

app.post('/api/start', async (req, res) => {
    try {
        console.log('🚀 Solicitud de inicio');
        
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ 
                success: true, 
                message: 'Mancy iniciándose...',
                status: 'starting'
            });
        } else {
            res.json({ 
                success: true, 
                message: botActive ? 'Ya activa' : 'Ya iniciándose',
                status: botActive ? 'active' : 'starting'
            });
        }
    } catch (error) {
        console.error('❌ Error en start:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        console.log('🛑 Solicitud de detención');
        
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            res.json({ 
                success: true, 
                message: 'Mancy detenida',
                status: 'stopped'
            });
        } else {
            res.json({ 
                success: true, 
                message: 'Ya inactiva',
                status: 'inactive'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/health', (req, res) => {
    const stats = memoryManager.obtenerEstadisticas();
    const reasoningStats = reasoningEngine.obtenerEstadisticas();  // NUEVO
    
    res.json({
        status: 'healthy',
        bot_active: botActive,
        filtro: 'activado',
        razonamiento: 'activado',  // NUEVO
        apis: '6 fuentes confiables',
        memory_users: stats.totalUsuarios,
        memory_messages: stats.totalMensajes,
        memory_max: 270,
        reasoning_knowledge: reasoningStats.baseConocimiento,  // NUEVO
        uptime: process.uptime()
    });
});

app.post('/wakeup', async (req, res) => {
    console.log('🔔 Wakeup recibido');
    
    if (!botActive && !isStartingUp) {
        startBot();
    }
    
    res.json({ 
        success: true, 
        message: 'Activando...',
        bot_active: botActive
    });
});

app.get('/api/buscar/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const resultado = await conocimiento.buscarInformacion(query);
        
        res.json({
            success: true,
            query: query,
            encontrado: resultado.encontrado,
            fuente: resultado.datos?.fuente,
            resumen: resultado.resumen,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║         🤖 MANCY A.I - CONFILABLE        ║
║       6 FUENTES GARANTIZADAS             ║
║         + FILTRO SARCÁSTICO              ║
║         + RAZONAMIENTO LÓGICO            ║  // NUEVO
║                                          ║
║  📖 Wikipedia (ES/EN)                    ║
║  🌍 RestCountries (Países)              ║
║  📜 PoetryDB (Poesía)                    ║
║  💭 Quotable (Citas)                     ║
║  📕 Free Dictionary (Inglés)             ║
║  🌤️ Open-Meteo (Clima)                   ║
║  🤔 Motor de Razonamiento                ║  // NUEVO
║                                          ║
║  ✅ TODAS FUNCIONAN SIN TOKEN            ║
║  ✅ SIN LÍMITES GRAVES                   ║
║  ✅ RÁPIDAS Y CONFIABLES                 ║
║                                          ║
║  🛡️  Filtro: ACTIVADO                    ║
║  🎭 Respuestas: Sarcásticas-elegantes    ║
║  ✋ DM inapropiados: BLOQUEADOS          ║
║  🧠 Razonamiento: Lógico y analítico     ║  // NUEVO
║                                          ║
║  🧠 Memoria: 270 mensajes                ║
║  ❤️  Personalidad: Cálida pero firme     ║
║                                          ║
║  Puerto: ${PORT}                         ║
║  URL: http://localhost:${PORT}           ║
╚══════════════════════════════════════════╝
    `);
    
    console.log('\n✨ Para probar conexión:');
    console.log(`   curl http://localhost:${PORT}/test`);
    console.log(`   curl http://localhost:${PORT}/health`);
    
    console.log('\n🚀 Endpoints disponibles:');
    console.log(`   POST /api/start  - Iniciar bot`);
    console.log(`   POST /api/stop   - Detener bot`);
    console.log(`   GET  /api/status - Ver estado`);
    console.log(`   GET  /api/filtro-status - Ver filtro`);
    console.log(`   GET  /api/buscar/:query - Buscar info`);
    
    console.log('\n🤖 Comandos de Razonamiento:');
    console.log(`   !razonar [pregunta] - Activar razonamiento`);
    console.log(`   !estadisticas-razonamiento - Ver stats`);
    console.log(`   !aprender - Info del sistema`);
    console.log(`   !debug-razonamiento - Test del sistema`);
    
    if (process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
        console.log('\n🔑 Tokens detectados, iniciando en 3 segundos...');
        setTimeout(() => {
            startBot().catch(err => {
                console.log('⚠️ Auto-inicio falló:', err.message);
            });
        }, 3000);
    }
});

process.on('SIGTERM', () => {
    console.log('💤 Apagando...');
    
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Mancy desconectada');
    }
    
    process.exit(0);
});
