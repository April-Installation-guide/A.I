// test-server.js - Para verificar que todo funciona
import express from 'express';

const app = express();
const PORT = 11000;

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Mancy Bot Server',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

app.get('/panel', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Mancy Panel</title></head>
        <body>
            <h1>Mancy Bot Panel</h1>
            <p>Bot: ${process.env.DISCORD_BOT_TOKEN ? 'Token configurado' : 'Token NO configurado'}</p>
            <p>Groq: ${process.env.GROQ_API_KEY ? 'API Key configurada' : 'API Key NO configurada'}</p>
            <p>Puerto: ${PORT}</p>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`✅ Servidor funcionando en puerto ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`📊 Panel: http://localhost:${PORT}/panel`);
    
    // Verificar variables de entorno
    console.log('\n🔍 Variables de entorno:');
    console.log(`   DISCORD_BOT_TOKEN: ${process.env.DISCORD_BOT_TOKEN ? '✅ Presente' : '❌ Faltante'}`);
    console.log(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Presente' : '❌ Faltante'}`);
    console.log(`   PORT: ${process.env.PORT || '11000 (default)'}`);
});
