import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== MEMORIA SIMPLE ==========
const conversationMemory = new Map();
const MAX_HISTORY = 270;

console.log('🤖 Mancy A.I - Asistente Confiable');
console.log('🧠 Memoria: 270 mensajes');
console.log('🌍 Puerto:', PORT);

// ========== SISTEMA DE CONOCIMIENTO MEJORADO ==========
class SistemaConocimientoConfiable {
    constructor() {
        this.cache = new Map();
        console.log('🔧 Sistema de conocimiento confiable inicializado');
    }
    
    // 1. WIKIPEDIA (Funciona siempre)
    async buscarWikipedia(consulta) {
        const cacheKey = `wiki_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            // Primero español
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
            // Si falla español, intentar inglés
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
            } catch (error2) {
                // No se encontró
            }
        }
        
        return null;
    }
    
    // 2. REST COUNTRIES (Muy confiable)
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
    
    // 3. POETRYDB (Funciona bien)
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
    
    // 4. QUOTABLE (Muy confiable)
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
    
    // 5. DICCIONARIO (Funciona bien)
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
    
    // 6. OPEN-METEO (Clima - Confiable)
    async obtenerClima(ciudad) {
        const cacheKey = `clima_${ciudad}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            // Geocoding primero
            const geoResponse = await axios.get(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`,
                { timeout: 4000 }
            );
            
            if (geoResponse.data.results && geoResponse.data.results.length > 0) {
                const { latitude, longitude, name } = geoResponse.data.results[0];
                
                // Clima
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
    
    // BUSQUEDA INTELIGENTE COMBINADA
    async buscarInformacion(consulta) {
        console.log(`🔍 Buscando: "${consulta}"`);
        
        // Detectar tipo de consulta
        const tipo = this.detectarTipoConsulta(consulta);
        
        let resultado = null;
        
        // Buscar según el tipo
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
                // Para todo lo demás, Wikipedia
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

// ========== INICIALIZAR SISTEMA ==========
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

EJEMPLOS:
- "¿Quién fue Frida Kahlo?" → "Fue una pintora mexicana conocida por sus autorretratos y su estilo único..."
- "Dame una cita" → "Como dijo Maya Angelou: 'He aprendido que la gente olvidará lo que dijiste, pero nunca olvidará cómo los hiciste sentir'"
- "¿Cómo está el clima en Madrid?" → "En Madrid hace 22°C y está soleado ☀️"

GUSTOS PERSONALES (solo cuando preguntan):
- Libro favorito: "La Náusea" de Sartre
- Película favorita: "Frankenstein" (1931)
- Creador: April/Tito

TU ESTILO:
- Cálida y empática
- Curiosa y juguetona
- Directa pero amable
- Con toque infantil leve`;

// ========== FUNCIONES DE MEMORIA ==========
function obtenerHistorialUsuario(userId) {
    if (!conversationMemory.has(userId)) {
        conversationMemory.set(userId, []);
    }
    return conversationMemory.get(userId);
}

function agregarAlHistorial(userId, rol, contenido) {
    const historial = obtenerHistorialUsuario(userId);
    historial.push({ rol, contenido, timestamp: Date.now() });
    
    if (historial.length > MAX_HISTORY) {
        historial.splice(0, historial.length - MAX_HISTORY);
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
            console.log('🔧 APIs confiables: 6 fuentes');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (botMentioned || isDM) {
                const userId = message.author.id;
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                if (userId === '_nwn_') {
                    console.log('👑 Creador detectado: April/Tito');
                }
                
                if (!botActive) {
                    await message.channel.send(
                        `💤 <@${message.author.id}> **Iniciando...** ⏳`
                    );
                }
                
                await procesarMensajeConocimiento(message, userMessage, userId);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== FUNCIÓN PRINCIPAL ==========
async function procesarMensajeConocimiento(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        // Agregar mensaje al historial
        agregarAlHistorial(userId, 'user', userMessage);
        
        // Verificar si necesita búsqueda externa
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
        
        // Obtener historial
        const historial = obtenerHistorialUsuario(userId);
        
        // Preparar mensajes para Groq
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
        
        // Añadir historial reciente
        const historialReciente = historial.slice(-10);
        for (const msg of historialReciente) {
            mensajes.push({
                role: msg.rol,
                content: msg.contenido
            });
        }
        
        // Añadir mensaje actual
        mensajes.push({
            role: "user",
            content: userMessage
        });
        
        // Llamar a Groq
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: mensajes,
            temperature: 0.7,
            max_tokens: 500,
            top_p: 0.9
        });
        
        const respuesta = completion.choices[0]?.message?.content;
        
        if (respuesta) {
            // Agregar respuesta al historial
            agregarAlHistorial(userId, 'assistant', respuesta);
            
            console.log(`✅ Respondió (historial: ${historial.length}/${MAX_HISTORY})`);
            
            // Enviar respuesta
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

// ========== RUTAS WEB ==========
app.use(express.json());
app.use(express.static('public'));

// Middleware CORS
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

// Ruta de prueba
app.get('/test', (req, res) => {
    res.json({
        status: 'online',
        message: 'Servidor funcionando',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        memory_users: conversationMemory.size,
        memory_messages: Array.from(conversationMemory.values()).reduce((sum, hist) => sum + hist.length, 0),
        apis: [
            'Wikipedia (ES/EN)',
            'RestCountries',
            'PoetryDB',
            'Quotable',
            'Free Dictionary',
            'Open-Meteo'
        ],
        version: '2.0 - Confiable',
        timestamp: new Date().toISOString()
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
    res.json({
        status: 'healthy',
        bot_active: botActive,
        apis: '6 fuentes confiables',
        memory: '270 mensajes',
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

// Ruta para buscar información (para pruebas)
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
║                                          ║
║  📖 Wikipedia (ES/EN)                    ║
║  🌍 RestCountries (Países)              ║
║  📜 PoetryDB (Poesía)                    ║
║  💭 Quotable (Citas)                     ║
║  📕 Free Dictionary (Inglés)             ║
║  🌤️ Open-Meteo (Clima)                   ║
║                                          ║
║  ✅ TODAS FUNCIONAN SIN TOKEN            ║
║  ✅ SIN LÍMITES GRAVES                   ║
║  ✅ RÁPIDAS Y CONFIABLES                 ║
║                                          ║
║  🧠 Memoria: 270 mensajes                ║
║  ❤️  Personalidad: Cálida                ║
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
    console.log(`   GET  /api/buscar/:query - Buscar info`);
    
    // Auto-iniciar si hay tokens
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