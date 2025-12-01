import express from "express";
import { spawn } from "child_process";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.static("public"));

let botProcess = null;
let logs = [];

// enviar logs al cliente cada vez que los pida
app.get("/logs", (req, res) => {
  res.json(logs);
});

// ENCENDER BOT
app.get("/start", (req, res) => {
  if (botProcess) {
    return res.send("El bot ya está encendido.");
  }

  botProcess = spawn("node", ["bot.js"]);

  logs.push("Bot iniciado.");

  botProcess.stdout.on("data", (data) => {
    logs.push(data.toString());
  });

  botProcess.stderr.on("data", (data) => {
    logs.push("ERROR: " + data.toString());
  });

  botProcess.on("close", () => {
    logs.push("Bot detenido.");
    botProcess = null;
  });

  res.send("Bot encendido.");
});

// APAGAR BOT
app.get("/stop", (req, res) => {
  if (!botProcess) {
    return res.send("El bot ya está apagado.");
  }

  botProcess.kill();
  botProcess = null;
  logs.push("Bot apagado.");

  res.send("Bot apagado correctamente.");
});

// Página
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./public" });
});

app.listen(3000, () => console.log("Panel listo en http://localhost:3000"));
