const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const checklistRoutes = require("./routes/checklistRoutes");
const respostaRoutes = require("./routes/respostaRoutes");
const authRoutes = require("./routes/authRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/checklists", checklistRoutes);
app.use("/api/respostas", respostaRoutes);

app.get("/api/status", (req, res) => {
  res.json({
    mensagem: "Backend do Web Checklist funcionando!",
    status: "online",
    ambiente: process.env.VERCEL ? "vercel" : "local"
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;