import express from 'express';
import { getBotStatus, initializeAndStartBot, forceRestartBot, shutdownBot, getUserMemoryInfo } from './bot.js';
import { SYSTEM_CONSTANTS } from './src/config/constants.js';

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());

// Rutas de estado
app.get('/', (req, res) => {
    res.json({
        message: 'Bot de Discord con Groq API y Memoria Conversacional',
        version: SYSTEM_CONSTANTS.VERSION || '2.0.0',
        features: [
            'Memoria de conversación por usuario',
            'Seguimiento de temas',
            'Aprendizaje de preferencias',
            'Contexto de conversación',
            'Comandos de memoria (!memoria, !olvidar, !temas)'
        ],
        endpoints: [
            '/status - Estado del bot',
            '/memory/:userId - Información de memoria de usuario',
            '/restart - Reiniciar bot',
            '/shutdown - Apagar bot'
        ]
    });
});

app.get('/status', (req, res) => {
    res.json(getBotStatus());
});

app.get('/memory/:userId', (req, res) => {
    const { userId } = req.params;
    res.json(getUserMemoryInfo(userId));
});

app.post('/restart', (req, res) => {
    forceRestartBot();
    res.json({ message: 'Reinicio solicitado' });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor Express escuchando en el puerto ${PORT}`);
    console.log(`🧠 Memoria conversacional: ${process.env.ENABLE_MEMORY !== 'false' ? 'ACTIVADA' : 'DESACTIVADA'}`);
    
    setTimeout(() => {
        initializeAndStartBot();
    }, 1000);
});

// Manejo de apagado elegante
process.on('SIGTERM', async () => {
    console.log('SIGTERM recibido, apagando...');
    await shutdownBot();
    server.close(() => {
        console.log('Servidor HTTP cerrado');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT recibido, apagando...');
    await shutdownBot();
    server.close(() => {
        console.log('Servidor HTTP cerrado');
        process.exit(0);
    });
});
