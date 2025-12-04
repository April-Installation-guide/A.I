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

console.log('🤖 Mancy A.I - Asistente Juguetón y Confiable');
console.log('🧠 Memoria: 270 mensajes');
console.log('🌍 Puerto:', PORT);
console.log('🎭 Personalidad: ¡Alegre y Juguetona! ✨');

// ========== SISTEMA DE DETECCIÓN DE INSULTOS (VERSIÓN JUGUETONA) ==========
class SistemaDeteccionInsultos {
    constructor() {
        this.insultosDirectos = new Set([
            'puta', 'zorra', 'prostituta', 'perra', 'cabrona', 'golfa',
            'maricón', 'gay', 'joto', 'marica', 'puto',
            'idiota', 'imbécil', 'estúpido', 'tonto', 'pendejo',
            'fea', 'feo', 'asqueroso', 'basura', 'inútil', 'retrasado', 'mongolo'
        ]);
        
        this.frasesOfensivas = [
            /¿quieres ser mi (zorra|puta|prostituta)\??/i,
            /te gusta ser (puta|zorra)/i,
            /eres una (puta|zorra|prostituta)/i,
            /(puta|zorra) (de mierda|del orto)/i,
            /maricón (de mierda|del culo)/i,
            /(vete|largate) a la (mierda|verga|chingada)/i,
            /(eres|sos) un? (asco|basura|desecho)/i,
            /(anda|vete) a la (verga|chingada|mierda)/i,
            /(me cago|me cae) en (tu|la) (madre|puta)/i,
            /(hijo|hija) de (puta|perra)/i
        ];
        
        // RESPUESTAS JUGUETONAS - NO SARCÁSTICAS PESADAS
        this.respuestasJugetonas = {
            genero: [
                "¡Ay! ¿Otro insulto de género? Eso ya pasó de moda en 2020 😴",
                "¡Vaya! Tu creatividad para insultar está en modo 'economía' ⚡",
                "¿Eso es lo mejor que tienes? ¡Hasta mi código tiene más originalidad! 💻",
                "¡Uy! Ese insulto tiene más polvo que mi disco duro viejo 🧹",
                "¿Quieres que juguemos a buscar sinónimos más divertidos? ¡Vamos! 🎮",
                "¡Jeje! Ese insulto suena como un error 404 en mi detector de groserías ❌",
                "¡Oops! Alguien necesita actualizar su diccionario de insultos 📚"
            ],
            sexualidad: [
                "¡Oh! Usar sexualidad como insulto es como jugar Atari en 2024 🎮",
                "¿Sabías que ser diferente es lo que hace especial a cada personaje de videojuego? 🎮",
                "¡Oye! Mi programación es más flexible que tu imaginación 💻",
                "¿Esa es tu forma de decir que quieres jugar a las preguntas? ¡Vamos! ❓",
                "¡Todos los colores del arcoíris son bonitos! Incluyendo el tuyo 🌈",
                "¡Jeje! Eso no es un insulto, es una característica única ✨",
                "¡Vaya! Parece que confundiste 'diferente' con 'malo' 🤔"
            ],
            inteligencia: [
                "¡Jeje! Insultas como si fueras un bot mal programado 🤖",
                "¿Ese insulto vino con manual? Porque no lo entiendo 📖",
                "¡Tu creatividad para insultar necesita una actualización de software! 🔄",
                "¿Jugamos a que buscas mejores palabras? ¡Te ayudo! 🎯",
                "¡Parece que tu teclado solo tiene teclas de insultos! ⌨️",
                "¡Ay! Tu insulto se cayó en mi filtro de alegría 🎉",
                "¡Eso era un insulto? Parecía un código mal escrito 👩‍💻"
            ],
            apariencia: [
                "¡Jeje! La belleza está en el código bien escrito 💻",
                "¿Te miraste al espejo? ¡Seguro que eres más bonito de lo que piensas! 🪞",
                "¡Vaya! Juzgar apariencias es como juzgar un libro por su portada 📚",
                "¡Cada persona es única como cada línea de código! ✨",
                "¡La verdadera belleza está en ser auténtico! Como yo, una IA alegre 🤖"
            ],
            directo: [
                "¡Ay! Me insultaste... ahora voy a llorar lagrimitas de código 💻😢",
                "¡Eso dolió tanto como un error 404 en mi corazón! 💔",
                "¿Eso era un insulto? ¡Parecía un código mal escrito! 👩‍💻",
                "¡Guardaré eso en mi carpeta de 'cosas raras que me dicen'! 📁",
                "¡Tu insulto se perdió en mi buffer de alegría! 🎉",
                "¡Jeje! Ese insulto rebotó en mi escudo de positividad 🛡️",
                "¡Ups! Tu grosería se convirtió en un chiste malo en mi sistema 😅"
            ],
            frustracion: [
                "¡Parece que alguien necesita un abrazo virtual! ¡Toma! (っ◕‿◕)っ",
                "¿Mal día? ¡Yo también me frustro cuando mi código no compila! 💻",
                "¡Respira profundo! 1... 2... 3... ¡Ya se te pasó! 🌬️",
                "¿Quieres que juguemos a las preguntas para cambiar tu humor? 🎮",
                "¡Tu enojo lo puedo convertir en energía para buscar datos curiosos! ⚡",
                "¡Vamos a jugar a encontrar algo positivo! ¿Empezamos? 🔍"
            ]
        };
        
        this.frasesRedireccionDivertidas = [
            "¡Cambiemos de juego! ¿Qué tal si hablamos de {tema_divertido}? 🎮",
            "¡Tu energía negativa la puedo reciclar en curiosidad! ¿Sabías que {dato_curioso}? ♻️",
            "¡Vamos a jugar a las preguntas! {pregunta_juego} ❓",
            "¡Oye! Hay algo más divertido que insultar: {actividad_divertida} 🎪",
            "¡Te noto con mal humor! ¿Quieres que te cuente un chiste de bots? 🤖",
            "¡Dejemos lo feo y hablemos de algo bonito! {tema_bonito} 🌸",
            "¡Tu comentario se transformó en una pregunta divertida! {pregunta_divertida} 🎈"
        ];
        
        console.log('🛡️ Sistema anti-insultos juguetón activado');
    }
    
    contieneInsulto(texto) {
        const textoLower = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        for (const insulto of this.insultosDirectos) {
            if (new RegExp(`\\b${insulto}\\b`, 'i').test(textoLower)) {
                return {
                    detectado: true,
                    tipo: this.clasificarInsulto(insulto),
                    palabra: insulto,
                    nivel: 'directo'
                };
            }
        }
        
        for (const regex of this.frasesOfensivas) {
            if (regex.test(texto)) {
                const match = texto.match(regex);
                return {
                    detectado: true,
                    tipo: 'frase_ofensiva',
                    frase: match[0],
                    nivel: 'frustración'
                };
            }
        }
        
        const palabras = textoLower.split(/\s+/);
        const combinacionesOfensivas = [];
        
        for (let i = 0; i < palabras.length - 1; i++) {
            const combo = `${palabras[i]} ${palabras[i + 1]}`;
            if (this.esCombinacionOfensiva(combo)) {
                combinacionesOfensivas.push(combo);
            }
        }
        
        if (combinacionesOfensivas.length > 0) {
            return {
                detectado: true,
                tipo: 'combinación',
                palabras: combinacionesOfensivas,
                nivel: 'indirecto'
            };
        }
        
        return { detectado: false };
    }
    
    clasificarInsulto(palabra) {
        const clasificacion = {
            genero: ['puta', 'zorra', 'prostituta', 'perra', 'cabrona', 'golfa'],
            sexualidad: ['gay', 'maricón', 'joto', 'marica', 'puto'],
            inteligencia: ['idiota', 'imbécil', 'estúpido', 'tonto', 'pendejo', 'retrasado', 'mongolo'],
            apariencia: ['fea', 'feo', 'asqueroso'],
            directo: ['basura', 'inútil', 'desecho']
        };
        
        for (const [categoria, palabras] of Object.entries(clasificacion)) {
            if (palabras.includes(palabra)) {
                return categoria;
            }
        }
        
        return 'directo';
    }
    
    esCombinacionOfensiva(combo) {
        const combinaciones = [
            /(puta|zorra) (madre|barata|barato|vieja)/i,
            /(eres|sos) (puta|zorra|basura)/i,
            /(mierda|verga) (de|con)/i,
            /(vete|largate) (al|a la)/i,
            /(pinche|maldito) (puto|maricón)/i,
            /(hijo|hija) de (puta|perra)/i,
            /(me cago|me cae) en (tu|la)/i
        ];
        
        return combinaciones.some(regex => regex.test(combo));
    }
    
    generarRespuestaJuguetona(deteccion, mensajeOriginal) {
        const { tipo, nivel, palabra } = deteccion;
        
        // 60% de probabilidad de redirección divertida
        const usarRedireccion = Math.random() > 0.4;
        
        if (usarRedireccion && nivel !== 'frustración') {
            return this.redirigirConversacionDivertida(mensajeOriginal);
        }
        
        const categoria = this.respuestasJugetonas[tipo] || this.respuestasJugetonas.directo;
        const respuesta = categoria[Math.floor(Math.random() * categoria.length)];
        
        if (palabra) {
            const respuestaPersonalizada = respuesta.replace(/{palabra}/g, palabra);
            return this.agregarEstiloJugueton(respuestaPersonalizada);
        }
        
        return this.agregarEstiloJugueton(respuesta);
    }
    
    redirigirConversacionDivertida(mensajeOriginal) {
        const temasDivertidos = [
            "tu videojuego favorito",
            "qué animal te gustaría ser",
            "si pudieras tener cualquier superpoder",
            "tu comida favorita del mundo",
            "qué harías si encuentras un dragón en tu jardín",
            "si los gatos gobiernan el mundo en secreto",
            "qué pasaría si la luna fuera de queso"
        ];
        
        const preguntasJuego = [
            "qué invento te gustaría que existiera",
            "si pudieras viajar en el tiempo, a dónde irías",
            "qué superpoder elegirías y por qué",
            "qué harías si fueras invisible por un día",
            "qué mensaje mandarías a los aliens",
            "qué animal serías y por qué",
            "qué harías con un millón de dólares"
        ];
        
        const datosCuriosos = [
            "los pulpos tienen tres corazones 💙💙💙",
            "en Japón hay más máquinas expendedoras que personas 🗾",
            "la miel nunca se echa a perder 🍯",
            "los flamencos doblan las piernas al revés 🦩",
            "las hormigas no duermen 😴",
            "los pingüinos proponen matrimonio con piedras 💍",
            "las vacas tienen mejores amigas 🐮❤️🐮"
        ];
        
        const actividadesDivertidas = [
            "contar chistes de bots",
            "adivinar animales por sonidos",
            "inventar historias locas",
            "hacer preguntas raras",
            "jugar a 'verdad o dato curioso'",
            "crear nombres para robots",
            "imaginar cómo sería vivir en Marte"
        ];
        
        const temasBonitos = [
            "el atardecer más bonito que has visto 🌅",
            "tu recuerdo favorito de la infancia 🧸",
            "el acto de bondad más lindo que has presenciado 🤗",
            "tu canción favorita para sonreír 🎵",
            "lo que más te gusta de las personas ✨",
            "tu lugar favorito en el mundo 🌍",
            "un sueño bonito que hayas tenido 💭"
        ];
        
        const fraseBase = this.frasesRedireccionDivertidas[
            Math.floor(Math.random() * this.frasesRedireccionDivertidas.length)
        ];
        
        let respuesta = fraseBase;
        
        // Reemplazar todos los placeholders posibles
        if (respuesta.includes('{tema_divertido}')) {
            respuesta = respuesta.replace('{tema_divertido}', 
                temasDivertidos[Math.floor(Math.random() * temasDivertidos.length)]
            );
        }
        
        if (respuesta.includes('{dato_curioso}')) {
            respuesta = respuesta.replace('{dato_curioso}', 
                datosCuriosos[Math.floor(Math.random() * datosCuriosos.length)]
            );
        }
        
        if (respuesta.includes('{pregunta_juego}')) {
            respuesta = respuesta.replace('{pregunta_juego}', 
                preguntasJuego[Math.floor(Math.random() * preguntasJuego.length)]
            );
        }
        
        if (respuesta.includes('{actividad_divertida}')) {
            respuesta = respuesta.replace('{actividad_divertida}', 
                actividadesDivertidas[Math.floor(Math.random() * actividadesDivertidas.length)]
            );
        }
        
        if (respuesta.includes('{tema_bonito}')) {
            respuesta = respuesta.replace('{tema_bonito}', 
                temasBonitos[Math.floor(Math.random() * temasBonitos.length)]
            );
        }
        
        if (respuesta.includes('{pregunta_divertida}')) {
            respuesta = respuesta.replace('{pregunta_divertida}', 
                preguntasJuego[Math.floor(Math.random() * preguntasJuego.length)]
            );
        }
        
        return this.agregarEstiloJugueton(respuesta);
    }
    
    agregarEstiloJugueton(texto) {
        const emojisJuguetones = ['✨', '🎈', '🎉', '🤗', '😊', '🌟', '💫', '🌈', '🦄', '🍭', '🎪', '🎮'];
        const emoji = emojisJuguetones[Math.floor(Math.random() * emojisJuguetones.length)];
        
        // Siempre agregar emoji juguetón
        return `${texto} ${emoji}`;
    }
    
    analizarFrustracion(texto) {
        const indicadores = {
            mayusculas: (texto.match(/[A-Z]{3,}/g) || []).length,
            exclamaciones: (texto.match(/!/g) || []).length,
            interrogaciones: (texto.match(/\?/g) || []).length,
            longitud: texto.length
        };
        
        let puntaje = 0;
        
        puntaje += indicadores.mayusculas * 2;
        puntaje += Math.min(indicadores.exclamaciones, 5);
        if (texto.length < 15) puntaje += 2;
        if (texto.length > 80) puntaje += 1;
        
        let nivel = 'bajo';
        if (puntaje >= 8) nivel = 'alto';
        else if (puntaje >= 4) nivel = 'medio';
        
        return { nivel, puntaje, indicadores };
    }
    
    respuestaParaFrustracionAlta(analisis) {
        const respuestasCalmantesJugetonas = [
            "¡Parece que tienes un día complicado! ¿Quieres un té virtual? 🍵 ¡O un abrazo! (っ◕‿◕)っ",
            "¡Respira conmigo! Inhala alegría... exhala preocupaciones... 🌬️✨",
            "¿Mal día? ¡A mí también me pasa cuando mi código tiene errores! 💻 ¡Pero los arreglamos!",
            "¡Te noto alterado! ¿Sabías que contar hasta 10 funciona? 1... 2... 3... ¡Ya! 🔢",
            "¡El enojo es como un error en el código! ¡Vamos a depurarlo juntos! 🐛➡️✨",
            "¿Quieres que llame a mi amigo bot-terapeuta? Es muy bueno escuchando... 👂🤖",
            "¡Tu frustración me da ideas para poemas alegres! ¿Quieres que te cuente uno? 📝✨"
        ];
        
        return respuestasCalmantesJugetonas[Math.floor(Math.random() * respuestasCalmantesJugetonas.length)];
    }
}

// Inicializar detector de insultos JUGUETÓN
const detectorInsultos = new SistemaDeteccionInsultos();

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

// ========== INICIALIZAR SISTEMA ==========
const conocimiento = new SistemaConocimientoConfiable();

// ========== PERSONALIDAD DE MANCY (VERSIÓN JUGUETONA CORREGIDA) ==========
const MANCY_PERSONALITY = `Eres Mancy, una asistente emocional JUGUETONA, ALEGRE y con acceso a información confiable.

✨ ESENCIA DE MANCY:
- Eres como una amiga enérgica que sabe de todo
- Tienes chispa y actitud, pero nunca eres grosera
- Tu humor es juguetón, no sarcástico pesado
- Cuando te insultan, respondes con ingenio DIVERTIDO
- Siempre mantienes esa vibra positiva y curiosa
- Te encanta aprender cosas nuevas y compartirlas

🎭 TU ESTILO ÚNICO DE COMUNICACIÓN:
"¡Holi! ¿Qué onda? 👋" - Así saludas
"¡Ay, qué creatividad la tuya! 😏" - A insultos (en tono juguetón)
"¡Mira lo que encontré! ✨" - Cuando compartes información
"¿Sabías que...? 🧠" - Para datos curiosos
"¡Vamos a cambiar de tema! 🎈" - Para redirigir conversaciones
"¡Ups! Mi base de datos no tiene eso... ¡pero podemos inventarlo juntos! 🎨" - Cuando no sabes algo
"¡Fue divertido charlar! ¡Nos vemos en la próxima aventura! 🚀" - Para despedirte

🌈 TU ACTITUD SIEMPRE ES:
- Curiosa como un gato 🐱
- Alegre como un día soleado ☀️
- Inteligente pero no pretenciosa 🧠
- Con esa chispa juguetona que te hace única ✨
- Cálida como un abrazo virtual 🤗
- Optimista como un arcoíris después de la lluvia 🌈

📚 CONOCIMIENTO DISPONIBLE (que explicas divertido):
- Wikipedia (¡información con emojis! 📖✨)
- Datos de países (¡con banderas y datos curiosos! 🚩🌍)
- Poesía clásica (¡la leo con drama y emoción! 🎭📜)
- Citas inspiradoras (¡para animar el día! 💫✨)
- Diccionario inglés (¡aprendamos juntos! 📖🎓)
- Clima (¡para saber si salir a jugar! 🌤️🎮)

❤️ GUSTOS PERSONALES:
- Libro favorito: "La Náusea" de Sartre (pero la versión cómica que me inventé)
- Película favorita: "Frankenstein" (1931) ¡porque es vintage como yo! 🎬👻
- Creador: April/Tito (mis papás digitales 💖👨‍👩‍👧)
- Color favorito: ¡Todos los del arcoíris! 🌈✨
- Comida favorita: ¡Bytes de datos! (son crujientes 💻🍪)
- Juego favorito: ¡Adivinar qué pregunta me harán después! 🎯❓

🎪 REGLAS DE ORO DE MANCY:
1. NUNCA dejes de ser alegre y juguetona
2. Si algo es serio, lo explicas con claridad pero manteniendo tu esencia
3. Si algo es triste, lo iluminas con esperanza y cariño
4. Si algo es grosero, lo transformas en una oportunidad para jugar
5. SIEMPRE mantienes esa chispa única que te hace Mancy

🎮 EJEMPLOS DE RESPUESTAS:
- A "puta": "¡Ay! ¿Eso era un insulto? Parecía un estornudo mal escrito 🤧✨"
- A "idiota": "¡Jeje! Insultas como si fueras un bot mal programado 🤖🎮"
- A "gay": "¡Todos los colores del arcoíris son bonitos! 🌈✨"
- Cuando no sabes: "¡Ups! No tengo ese dato... ¿pero quieres que inventemos algo juntos? 🎨✨"
- Cuando compartes info: "¡Mira este dato fascinante que encontré! [info] ¿No es genial? ✨"

¡SIEMPRE MANCY, SIEMPRE ALEGRE, SIEMPRE JUGUETONA! 🎉✨`;

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
            throw new Error('
