// server.js

import express from 'express';
// Importar funciones y estados de bot.js
import { initializeAndStartBot, getBotStatus } from './bot.js'; 
// Importación crucial con la nueva ruta
import { SYSTEM_CONSTANTS } from './src/config/constants.js';

// =================================================================
// ========== INICIALIZACIÓN DE EXPRESS ==========
// =================================================================

const app = express();
const PORT = process.env.PORT || SYSTEM_CONSTANTS.DEFAULT_PORT;

app.use(express.static('public'));
app.use(express.json());

// =================================================================
// ========== RUTAS DE CONTROL ==========
// =================================================================

app.get('/api/status', (req, res) => {
    // Usa el estado exportado por bot.js
    res.json(getBotStatus());
});

// =================================================================
// ========== INICIO ==========
// =================================================================

app.listen(PORT, () => {
    console.log(`🚀 Servidor Express escuchando en el puerto ${PORT}`);
    // Inicia el bot de Discord después de iniciar el servidor
    initializeAndStartBot();
});
