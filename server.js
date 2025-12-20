import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ===============================
// Configuración inicial
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// Middleware
// ===============================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
// Variables globales para módulos
// ===============================
let modulesLoaded = {
    freeApis: false,
    knowledgeDetector: false,
    groqEnhanced: false,
    knowledgeIntegration: false
};

// ===============================
// Carga segura de módulos CON RUTAS CORREGIDAS
// ===============================

// 1. Free APIs Module - RUTA CORREGIDA: ./utils/ (no src/utils/)
let freeApisModule = {};
async function loadFreeAPIs() {
    try {
        // CORRECCIÓN: Importar desde ./utils/ (mismo nivel)
        const module = await import('./utils/free-apis.js');
        if (module && Object.keys(module).length > 0) {
            freeApisModule = module;
            modulesLoaded.freeApis = true;
            console.log('✅ Módulo free-apis.js cargado');
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar free-apis.js:', error.message);
        // Crear módulo simulado para desarrollo
        freeApisModule = {
            getRandomQuote: async () => ({
                success: true,
                quote: "El único modo de hacer un gran trabajo es amar lo que haces.",
                author: "Steve Jobs",
                category: "motivation"
            }),
            getCryptoPrice: async (coin = 'bitcoin') => ({
                success: true,
                coin: coin,
                prices: { usd: 45000 + Math.random() * 10000 },
                change_24h: Math.random() * 10 - 5
            }),
            getRandomFact: async () => ({
                success: true,
                fact: "Las abejas pueden reconocer rostros humanos.",
                category: "animals"
            }),
            translate: async (text, lang = 'es') => ({
                success: true,
                original: text,
                translated: `[${lang}] ${text}`,
                language: lang
            })
        };
    }
    return false;
}

// 2. Knowledge Detector Module - RUTA CORREGIDA
let analyzeUserMessage = null;
async function loadKnowledgeDetector() {
    try {
        const module = await import('./utils/knowledge-detector.js');
        if (module.analyzeUserMessage) {
            analyzeUserMessage = module.analyzeUserMessage;
            modulesLoaded.knowledgeDetector = true;
            console.log('✅ Módulo knowledge-detector.js cargado');
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar knowledge-detector.js:', error.message);
        // Función por defecto
        analyzeUserMessage = (message) => ({
            topic: 'general',
            requiresKnowledge: message.length > 20 && /qué|quien|cómo|por qué|define|explica/i.test(message),
            confidence: 0.7,
            categories: ['general'],
            keywords: message.toLowerCase().split(' ').filter(w => w.length > 3)
        });
    }
    return true; // Siempre devuelve true porque tenemos fallback
}

// 3. Groq Enhanced Module - RUTA CORREGIDA
let getGroqChatCompletion = null;
async function loadGroqEnhanced() {
    try {
        const module = await import('./services/groq-enhanced.js');
        
        // Verificar si es default export
        const GroqEnhanced = module.default || module.GroqEnhanced || module;
        
        if (GroqEnhanced && process.env.GROQ_API_KEY) {
            const instance = new GroqEnhanced(process.env.GROQ_API_KEY);
            
            getGroqChatCompletion = async (message, knowledge) => {
                try {
                    // Usar la función existente o crear una wrapper
                    if (typeof instance.generateEnhancedResponse === 'function') {
                        const result = await instance.generateEnhancedResponse(message, [], 'user');
                        return result.response || result.message || 'No response generated';
                    } else {
                        return `🤖 [Groq]: He procesado tu mensaje: "${message.substring(0, 100)}"`;
                    }
                } catch (error) {
                    console.error('Error calling Groq:', error.message);
                    return `⚠️ Hubo un error con Groq: ${error.message}`;
                }
            };
            
            modulesLoaded.groqEnhanced = true;
            console.log('✅ Módulo groq-enhanced.js cargado');
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar groq-enhanced.js:', error.message);
    }
    
    // Fallback sin Groq
    getGroqChatCompletion = async (message) => {
        return `🤖 [Bot]: He recibido: "${message}". Groq no está disponible, pero puedo ayudarte con otras funciones.`;
    };
    return false;
}

// 4. Knowledge Integration Module - RUTA CORREGIDA
let integrateKnowledge = null;
async function loadKnowledgeIntegration() {
    try {
        const module = await import('./services/knowledge-integration.js');
        
        // Manejar diferentes tipos de exportación
        const integration = module.default || module.knowledgeIntegration || module;
        
        if (integration && integration.processMessage) {
            integrateKnowledge = async (message, analysis) => {
                try {
                    const result = await integration.processMessage(message);
                    return result.knowledge || null;
                } catch (error) {
                    console.error('Error processing knowledge:', error);
                    return null;
                }
            };
            modulesLoaded.knowledgeIntegration = true;
            console.log('✅ Módulo knowledge-integration.js cargado');
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar knowledge-integration.js:', error.message);
    }
    
    // Fallback simple
    integrateKnowledge = async (message, analysis) => {
        if (analysis.requiresKnowledge) {
            return {
                source: 'fallback',
                summary: `Información sobre ${analysis.topic}`,
                fetched: new Date().toISOString()
            };
        }
        return null;
    };
    return false;
}

// ===============================
// Funciones de utilidad
// ===============================

// Función para obtener APIs gratuitas
async function getFreeAPIsList() {
    // Intentar usar el módulo si está disponible
    if (modulesLoaded.freeApis && freeApisModule.getFreeAPIs) {
        try {
            return await freeApisModule.getFreeAPIs();
        } catch (error) {
            console.error('Error usando getFreeAPIs:', error);
        }
    }
    
    // Datos de fallback
    return {
        success: true,
        count: 5,
        apis: [
            {
                name: 'Quotable API',
                description: 'Citas y frases inspiradoras',
                url: 'https://api.quotable.io/',
                category: 'Quotes',
                free: true,
                example: 'GET /quotes/random'
            },
            {
                name: 'REST Countries',
                description: 'Información sobre países del mundo',
                url: 'https://restcountries.com/v3.1/all',
                category: 'Geography',
                free: true,
                example: 'GET /name/{country}'
            },
            {
                name: 'OpenWeatherMap',
                description: 'Datos meteorológicos globales',
                url: 'https://openweathermap.org/api',
                category: 'Weather',
                free: true,
                example: 'GET /weather?q={city}'
            },
            {
                name: 'JokeAPI',
                description: 'API de chistes y bromas',
                url: 'https://jokeapi.dev/',
                category: 'Entertainment',
                free: true,
                example: 'GET /joke/Any'
            },
            {
                name: 'Dog CEO',
                description: 'Imágenes aleatorias de perros',
                url: 'https://dog.ceo/dog-api/',
                category: 'Animals',
                free: true,
                example: 'GET /breeds/image/random'
            }
        ],
        timestamp: new Date().toISOString(),
        note: 'Datos de demostración - APIs reales disponibles'
    };
}

// ===============================
// Cargar todos los módulos al inicio
// ===============================
async function loadAllModules() {
    console.log('📦 Cargando módulos desde:', __dirname);
    
    await Promise.allSettled([
        loadFreeAPIs(),
        loadKnowledgeDetector(),
        loadGroqEnhanced(),
        loadKnowledgeIntegration()
    ]);
    
    console.log('📊 Estado de módulos:');
    Object.entries(modulesLoaded).forEach(([name, loaded]) => {
        console.log(`   ${loaded ? '✅' : '⚠️ '} ${name}: ${loaded ? 'CARGADO' : 'FALLBACK'}`);
    });
}

// ===============================
// Routes
// ===============================

// 1. Home
app.get('/', (req, res) => {
    res.json({
        service: '🤖 Mancy Discord Bot API',
        version: '2.0.0',
        status: 'operational',
        description: 'API para el bot de Discord con integración de conocimiento e IA',
        endpoints: [
            'GET  / → Esta página',
            'GET  /health → Estado del servidor',
            'GET  /api/status → Estado del sistema',
            'GET  /api/free-apis → Lista de APIs gratuitas',
            'POST /api/chat → Chatbot con IA',
            'GET  /api/modules → Módulos cargados',
            'GET  /api/test/* → Probar funciones específicas',
            'GET  /api/demo → Demostración rápida',
            'GET  /api/env-check → Variables de entorno'
        ],
        documentation: 'https://github.com/tuusuario/mancy-bot',
        support: 'Únete a nuestro Discord para ayuda'
    });
});

// 2. Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(process.uptime())} segundos`,
        serverTime: new Date().toLocaleString(),
        nodeVersion: process.version,
        platform: process.platform
    });
});

// 3. API Status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'operational',
        serverTime: new Date().toISOString(),
        modules: modulesLoaded,
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        system: {
            arch: process.arch,
            platform: process.platform,
            memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        }
    });
});

// 4. List Free APIs
app.get('/api/free-apis', async (req, res) => {
    try {
        const apis = await getFreeAPIsList();
        res.json({
            success: true,
            data: apis,
            modules: modulesLoaded,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 5. Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'El mensaje es requerido y debe ser texto',
                example: { message: "Hola, ¿cómo estás?" }
            });
        }
        
        console.log(`💬 Chat request: "${message.substring(0, 100)}"`);
        
        // Paso 1: Analizar mensaje
        let analysis = { topic: 'general', requiresKnowledge: false };
        if (analyzeUserMessage) {
            analysis = analyzeUserMessage(message);
        }
        
        // Paso 2: Integrar conocimiento si es necesario
        let knowledge = null;
        if (analysis.requiresKnowledge && integrateKnowledge) {
            knowledge = await integrateKnowledge(message, analysis);
        }
        
        // Paso 3: Generar respuesta
        let response = '';
        if (getGroqChatCompletion) {
            response = await getGroqChatCompletion(message, knowledge);
        } else {
            response = `🤖 [Bot]: He recibido tu mensaje: "${message}"`;
            
            if (knowledge) {
                response += `\n🔍 He encontrado información sobre: ${analysis.topic}`;
            }
            
            if (modulesLoaded.freeApis) {
                response += '\n\n💡 También puedo ayudarte con:\n• Citas inspiradoras\n• Datos de criptomonedas\n• Traducciones\n• Hechos curiosos';
            }
        }
        
        // Respuesta exitosa
        res.json({
            success: true,
            response: response,
            analysis: analysis,
            knowledgeUsed: !!knowledge,
            modulesUsed: modulesLoaded,
            timestamp: new Date().toISOString(),
            responseLength: response.length
        });
        
    } catch (error) {
        console.error('Error en /api/chat:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// 6. Test specific API functions
app.get('/api/test/:function', async (req, res) => {
    const { function: funcName } = req.params;
    const { param } = req.query;
    
    try {
        let result = null;
        let moduleUsed = 'none';
        
        // Verificar si la función existe en freeApisModule
        if (modulesLoaded.freeApis && freeApisModule[funcName]) {
            moduleUsed = 'freeApis';
            
            try {
                // Ejecutar la función con parámetro si está disponible
                if (param) {
                    result = await freeApisModule[funcName](param);
                } else {
                    result = await freeApisModule[funcName]();
                }
            } catch (funcError) {
                result = {
                    success: false,
                    error: `Error ejecutando ${funcName}: ${funcError.message}`,
                    function: funcName,
                    param: param
                };
            }
        } else {
            // Datos de demostración
            result = {
                success: true,
                demo: true,
                function: funcName,
                param: param || 'none',
                message: `Función ${funcName} ${param ? `con parámetro "${param}"` : ''}`,
                data: {
                    getRandomQuote: {
                        quote: "La vida es 10% lo que te pasa y 90% cómo reaccionas.",
                        author: "Charles R. Swindoll",
                        category: "life"
                    },
                    getCryptoPrice: {
                        coin: param || 'bitcoin',
                        price: 45000 + Math.random() * 5000,
                        change: Math.random() * 10 - 5
                    },
                    getRandomFact: {
                        fact: "Los pulpos tienen sangre azul.",
                        category: "animals",
                        verified: true
                    },
                    translate: {
                        original: param || "Hello world",
                        translated: "Hola mundo",
                        language: "es"
                    }
                }[funcName] || {
                    note: `Función ${funcName} disponible en modo demo`,
                    timestamp: new Date().toISOString()
                }
            };
        }
        
        res.json({
            success: true,
            function: funcName,
            param: param || 'none',
            module: moduleUsed,
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            function: funcName,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 7. Module Status
app.get('/api/modules', (req, res) => {
    res.json({
        modules: modulesLoaded,
        loadedCount: Object.values(modulesLoaded).filter(Boolean).length,
        totalCount: Object.keys(modulesLoaded).length,
        details: {
            freeApis: modulesLoaded.freeApis ? '✅ Operativo' : '⚠️  Usando datos demo',
            knowledgeDetector: modulesLoaded.knowledgeDetector ? '✅ Operativo' : '⚠️  Usando fallback',
            groqEnhanced: modulesLoaded.groqEnhanced ? '✅ Conectado a Groq' : '⚠️  Modo simple',
            knowledgeIntegration: modulesLoaded.knowledgeIntegration ? '✅ Integrado' : '⚠️  No disponible'
        },
        serverInfo: {
            directory: __dirname,
            nodeVersion: process.version,
            uptime: process.uptime()
        },
        timestamp: new Date().toISOString()
    });
});

// 8. Quick Demo
app.get('/api/demo', async (req, res) => {
    try {
        // Probar diferentes funciones
        const tests = [];
        
        // Test 1: Cita aleatoria
        if (modulesLoaded.freeApis) {
            try {
                const quote = await freeApisModule.getRandomQuote?.();
                if (quote) tests.push({ 
                    type: 'quote', 
                    success: true,
                    data: `${quote.quote} - ${quote.author}` 
                });
            } catch (e) {
                tests.push({ 
                    type: 'quote', 
                    success: false,
                    error: e.message 
                });
            }
        }
        
        // Test 2: Análisis de texto
        if (analyzeUserMessage) {
            const analysis = analyzeUserMessage("¿Qué es la inteligencia artificial?");
            tests.push({ 
                type: 'analysis', 
                success: true,
                data: analysis 
            });
        }
        
        // Test 3: Chat simple
        if (getGroqChatCompletion) {
            const chatResponse = await getGroqChatCompletion("Hola, dime algo interesante");
            tests.push({ 
                type: 'chat', 
                success: true,
                data: chatResponse.substring(0, 200) 
            });
        }
        
        // Test 4: Hecho aleatorio
        if (modulesLoaded.freeApis && freeApisModule.getRandomFact) {
            try {
                const fact = await freeApisModule.getRandomFact();
                tests.push({ 
                    type: 'fact', 
                    success: true,
                    data: fact.fact 
                });
            } catch (e) {}
        }
        
        res.json({
            success: true,
            demo: true,
            tests: tests,
            modules: modulesLoaded,
            timestamp: new Date().toISOString(),
            summary: `Ejecutadas ${tests.length} pruebas de demo`
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 9. Environment Check
app.get('/api/env-check', (req, res) => {
    // Lista segura de variables (sin valores sensibles)
    const envVars = {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || 3000,
        GROQ_API_KEY: process.env.GROQ_API_KEY ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA',
        BOT_PREFIX: process.env.BOT_PREFIX || '! (default)',
        ENABLE_MEMORY: process.env.ENABLE_MEMORY || 'true',
        DEBUG_MODE: process.env.DEBUG_MODE || 'false'
    };
    
    res.json({
        environment: envVars,
        hasRequiredKeys: !!process.env.GROQ_API_KEY,
        serverTime: new Date().toISOString(),
        recommendations: !process.env.GROQ_API_KEY ? [
            'Agrega GROQ_API_KEY a tus variables de entorno',
            'Obtén una clave en: https://console.groq.com'
        ] : ['✅ Todas las configuraciones están en orden']
    });
});

// 10. Simple Echo (para pruebas rápidas)
app.get('/api/echo', (req, res) => {
    const { text } = req.query;
    res.json({
        echo: text || 'Hello World!',
        timestamp: new Date().toISOString(),
        received: new Date().toLocaleString(),
        ip: req.ip
    });
});

// ===============================
// Error Handlers
// ===============================

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada',
        path: req.path,
        method: req.method,
        availableRoutes: [
            'GET  /',
            'GET  /health',
            'GET  /api/status',
            'GET  /api/free-apis',
            'POST /api/chat',
            'GET  /api/modules',
            'GET  /api/test/:function',
            'GET  /api/demo',
            'GET  /api/env-check',
            'GET  /api/echo'
        ],
        timestamp: new Date().toISOString(),
        tip: 'Visita GET / para ver todos los endpoints disponibles'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 Error global:', err.message);
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 
            'Error interno del servidor' : err.message,
        timestamp: new Date().toISOString(),
        requestId: Date.now().toString(36)
    });
});

// ===============================
// Inicialización y arranque
// ===============================
async function startServer() {
    try {
        // Cargar módulos
        await loadAllModules();
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`
🚀 SERVIDOR INICIADO CORRECTAMENTE
================================
📡 Puerto: ${PORT}
🌍 URL: https://a-i-icr7.onrender.com
🔧 Entorno: ${process.env.NODE_ENV || 'development'}
⏰ Hora: ${new Date().toLocaleString()}

📦 MÓDULOS:
   • free-apis: ${modulesLoaded.freeApis ? '✅ Cargado' : '⚠️  Demo mode'}
   • knowledge-detector: ${modulesLoaded.knowledgeDetector ? '✅ Cargado' : '⚠️  Fallback'}
   • groq-enhanced: ${modulesLoaded.groqEnhanced ? '✅ Conectado a Groq' : '⚠️  Simple mode'}
   • knowledge-integration: ${modulesLoaded.knowledgeIntegration ? '✅ Cargado' : '⚠️  No disponible'}

🔍 ENDPOINTS PRINCIPALES:
   • https://a-i-icr7.onrender.com/health
   • https://a-i-icr7.onrender.com/api/status
   • https://a-i-icr7.onrender.com/api/chat (POST)
   • https://a-i-icr7.onrender.com/api/test/getRandomQuote
   • https://a-i-icr7.onrender.com/api/demo

💡 CONFIGURACIÓN:
   • Groq API: ${process.env.GROQ_API_KEY ? '✅ Presente' : '❌ Falta'}
   • Server: ✅ Funcionando
   • Status: 🟢 ONLINE
            `);
        });
        
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

// Iniciar servidor
startServer();

export default app;
