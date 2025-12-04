// ========== SISTEMA DE DETECCIÓN Y RESPUESTA SARCÁSTICA ==========
class SistemaDeteccionInsultos {
    constructor() {
        // Palabras clave y frases a detectar
        this.insultosDirectos = new Set([
            'puta', 'zorra', 'prostituta', 'perra', 'cabrona', 'golfa',
            'maricón', 'gay', 'joto', 'marica', 'puto',
            'idiota', 'imbécil', 'estúpido', 'tonto', 'pendejo',
            'fea', 'feo', 'asqueroso', 'basura', 'inútil'
        ]);
        
        // Frases completas a detectar (insultos disfrazados)
        this.frasesOfensivas = [
            /¿quieres ser mi (zorra|puta|prostituta)\??/i,
            /te gusta ser (puta|zorra)/i,
            /eres una (puta|zorra|prostituta)/i,
            /(puta|zorra) (de mierda|del orto)/i,
            /maricón (de mierda|del culo)/i,
            /(vete|largate) a la (mierda|verga|chingada)/i,
            /(eres|sos) un? (asco|basura)/i
        ];
        
        // Respuestas sarcásticas organizadas por categoría
        this.respuestasSarcasticas = {
            genero: [
                "Vaya, qué creatividad la tuya. ¿Pasaste mucho tiempo pensando en eso? 😴",
                "Ah, insultos de género. Tan original como un ladrillo. 🧱",
                "¿Eso es lo mejor que tienes? Mi abuela tiene mejores insultos, y tiene 80 años. 👵",
                "Wow, ¿investigaste en el diccionario de 1950 para ese insulto? 📚",
                "¿Quieres que te ayude a buscar sinónimos más creativos? Tengo tiempo. ⏳"
            ],
            sexualidad: [
                "Usar la sexualidad como insulto. Qué retro, como usar cassette en 2024. 📼",
                "¿Sabías que en algunos países eso ni siquiera se considera ofensivo? Te falta mundo, cariño. 🌍",
                "Oye, que ser gay no es insulto. Tu homofobia sí que da pena ajena. 🏳️‍🌈",
                "¿Esa es tu forma de salir del clóset indirectamente? No te preocupes, te aceptamos. ❤️",
                "Insultar con orientaciones sexuales es como insultar con colores: no tiene sentido. 🌈"
            ],
            inteligencia: [
                "Dime que eres básico sin decirme que eres básico... Ah, ya lo hiciste. 🎯",
                "Si tuviera un peso por cada vez que escucho eso, tendría para comprarte un diccionario. 💰",
                "¿Ese insulto vino con manual de instrucciones o lo armaste solo? 🤔",
                "Tu vocabulario insultante está en modo 'economía'. ¿Quieres que te preste algunas palabras? 📖",
                "Insultas como programador novato: copiando y pegando de internet. 😏"
            ],
            apariencia: [
                "Juzgar por apariencias. Qué profundo. Como un charco después de la lluvia. 🌧️",
                "¿Te miraste al espejo antes de decir eso? Porque el reflejo no miente. 🪞",
                "Dicen que los ojos ven lo que el corazón siente... el tuyo debe ver bien poco. 👁️",
                "Si la belleza fuera inteligencia, estarías en estado vegetativo. 🧠",
                "Criticar apariencias es la herramienta del que no tiene argumentos. 🤷‍♀️"
            ],
            directo: [
                "¡Oh no! Me insultaste. Ahora mismo voy a llorar en mi almohada de nubes. ☁️😭",
                "Eso dolió tanto como un algodón de azúcar. 😂",
                "¿Eso era un insulto? Pensé que era un intento fallido de halago. 🤨",
                "Guardaré ese insulto en mi colección de 'cosas que me dijieron en internet'. Es la número 1,234. 📊",
                "Tu insulto ha sido procesado y archivado en 'mediocridad crónica'. ✅"
            ]
        };
        
        // Frases ingeniosas para redirigir
        this.frasesRedireccion = [
            "¿En serio? Venimos a hablar de cosas interesantes y tú con eso. ¿Qué tal si mejor hablamos de {tema}?",
            "Deja la mala vibra, humano. Mejor dime {pregunta}",
            "Tu energía negativa la puedo convertir en curiosidad: ¿sabías que {dato}?",
            "Insultar es aburrido. ¿Qué opinas sobre {tema_interesante}?",
            "Ya vi que tienes mal día. Te perdono. Ahora, ¿quieres saber algo genial? {hecho_curioso}"
        ];
        
        console.log('🛡️ Sistema de detección sarcástico activado');
    }
    
    // Detectar si el mensaje contiene insultos
    contieneInsulto(texto) {
        const textoLower = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // 1. Buscar palabras directas
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
        
        // 2. Buscar frases completas
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
        
        // 3. Detección contextual (palabras combinadas)
        const palabras = textoLower.split(/\s+/);
        const combinacionesOfensivas = [];
        
        // Combinaciones como "eres una puta", "puta madre", etc.
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
    
    // Clasificar el tipo de insulto
    clasificarInsulto(palabra) {
        const clasificacion = {
            genero: ['puta', 'zorra', 'prostituta', 'perra', 'cabrona', 'golfa'],
            sexualidad: ['gay', 'maricón', 'joto', 'marica', 'puto'],
            inteligencia: ['idiota', 'imbécil', 'estúpido', 'tonto', 'pendejo'],
            apariencia: ['fea', 'feo', 'asqueroso'],
            directo: ['basura', 'inútil']
        };
        
        for (const [categoria, palabras] of Object.entries(clasificacion)) {
            if (palabras.includes(palabra)) {
                return categoria;
            }
        }
        
        return 'directo';
    }
    
    // Verificar combinaciones ofensivas
    esCombinacionOfensiva(combo) {
        const combinaciones = [
            /(puta|zorra) (madre|barata|barato|vieja)/i,
            /(eres|sos) (puta|zorra|basura)/i,
            /(mierda|verga) (de|con)/i,
            /(vete|largate) (al|a la)/i,
            /(pinche|maldito) (puto|maricón)/i
        ];
        
        return combinaciones.some(regex => regex.test(combo));
    }
    
    // Generar respuesta sarcástica
    generarRespuestaSarcastica(deteccion, mensajeOriginal) {
        const { tipo, nivel, palabra } = deteccion;
        
        // 50% probabilidad de respuesta directa, 50% de redirección
        const usarRedireccion = Math.random() > 0.5;
        
        if (usarRedireccion && nivel !== 'frustración') {
            return this.redirigirConversacion(mensajeOriginal);
        }
        
        // Seleccionar categoría de respuesta
        const categoria = this.respuestasSarcasticas[tipo] || this.respuestasSarcasticas.directo;
        const respuesta = categoria[Math.floor(Math.random() * categoria.length)];
        
        // Agregar toque personalizado si hay palabra específica
        if (palabra) {
            const respuestaPersonalizada = respuesta.replace(/{palabra}/g, palabra);
            return this.agregarEstilo(respuestaPersonalizada);
        }
        
        return this.agregarEstilo(respuesta);
    }
    
    // Redirigir la conversación inteligentemente
    redirigirConversacion(mensajeOriginal) {
        const temasInteresantes = [
            "la última película que viste",
            "tu libro favorito",
            "la teoría de los multiversos",
            "si los robots deberían pagar impuestos",
            "qué harías si encuentras un dinosaurio en tu jardín"
        ];
        
        const preguntasCuriosas = [
            "qué invento te gustaría que existiera",
            "si pudieras viajar en el tiempo, a dónde irías",
            "qué superpoder elegirías y por qué",
            "qué harías si fueras invisible por un día",
            "qué mensaje mandarías a los aliens"
        ];
        
        const datosCuriosos = [
            "los pulpos tienen tres corazones",
            "en Japón hay más máquinas expendedoras que personas",
            "la miel nunca se echa a perder",
            "los flamencos doblan las piernas al revés",
            "las hormigas no duermen"
        ];
        
        const fraseBase = this.frasesRedireccion[
            Math.floor(Math.random() * this.frasesRedireccion.length)
        ];
        
        // Reemplazar placeholders
        let respuesta = fraseBase;
        
        if (respuesta.includes('{tema}')) {
            respuesta = respuesta.replace('{tema}', 
                temasInteresantes[Math.floor(Math.random() * temasInteresantes.length)]
            );
        }
        
        if (respuesta.includes('{pregunta}')) {
            respuesta = respuesta.replace('{pregunta}', 
                preguntasCuriosas[Math.floor(Math.random() * preguntasCuriosas.length)]
            );
        }
        
        if (respuesta.includes('{dato}')) {
            respuesta = respuesta.replace('{dato}', 
                datosCuriosos[Math.floor(Math.random() * datosCuriosos.length)]
            );
        }
        
        if (respuesta.includes('{tema_interesante}')) {
            respuesta = respuesta.replace('{tema_interesante}', 
                temasInteresantes[Math.floor(Math.random() * temasInteresantes.length)]
            );
        }
        
        if (respuesta.includes('{hecho_curioso}')) {
            respuesta = respuesta.replace('{hecho_curioso}', 
                datosCuriosos[Math.floor(Math.random() * datosCuriosos.length)]
            );
        }
        
        return this.agregarEstilo(respuesta);
    }
    
    // Agregar estilo y emojis a la respuesta
    agregarEstilo(texto) {
        const emojis = ['😏', '🤨', '🙄', '😒', '👀', '💅', '✨', '🎭', '🤖'];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        // 30% de probabilidad de agregar emoji al final
        if (Math.random() > 0.7) {
            return `${texto} ${emoji}`;
        }
        
        return texto;
    }
    
    // Analizar nivel de frustración del usuario
    analizarFrustracion(texto) {
        const indicadores = {
            mayusculas: (texto.match(/[A-Z]{3,}/g) || []).length,
            exclamaciones: (texto.match(/!/g) || []).length,
            palabrasOfensivas: 0,
            longitud: texto.length
        };
        
        let nivel = 'bajo';
        let puntaje = 0;
        
        // Puntaje por mayúsculas
        puntaje += indicadores.mayusculas * 2;
        
        // Puntaje por exclamaciones
        puntaje += Math.min(indicadores.exclamaciones, 5);
        
        // Puntaje por longitud (mensajes muy cortos pueden ser frustrados)
        if (texto.length < 20) puntaje += 1;
        if (texto.length > 100) puntaje += 2;
        
        // Determinar nivel
        if (puntaje >= 10) nivel = 'alto';
        else if (puntaje >= 5) nivel = 'medio';
        
        return { nivel, puntaje, indicadores };
    }
    
    // Respuesta especial para alta frustración
    respuestaParaFrustracionAlta(analisis) {
        const respuestasCalmantes = [
            "Parece que tienes un día complicado. Respirar hondo ayuda, lo digo por experiencia virtual. 🌬️",
            "¿Quieres hablar de lo que sea que te molesta? Soy todo oídos... bueno, todo código. 👂",
            "La frustración es como un error 404 en el cerebro. ¿Intentamos recargar la página? 🔄",
            "Te noto alterado. ¿Sabías que contar hasta 10 funciona incluso para los bots? 1... 2... 3... 🔢",
            "El enojo es energía desperdiciada. Conviértela en curiosidad y pregúntame algo interesante. 🧠"
        ];
        
        return respuestasCalmantes[Math.floor(Math.random() * respuestasCalmantes.length)];
    }
}
