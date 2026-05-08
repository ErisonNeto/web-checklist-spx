const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const arquivoUsuarios = path.join(__dirname, "../data/usuarios.json");

function lerUsuarios() {
  if (!fs.existsSync(arquivoUsuarios)) {
    return [];
  }

  const conteudo = fs.readFileSync(arquivoUsuarios, "utf8").replace(/^\uFEFF/, "");

  try {
    return JSON.parse(conteudo);
  } catch (erro) {
    return [];
  }
}

router.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({
      mensagem: "Informe usuário e senha."
    });
  }

  const usuarios = lerUsuarios();

  const usuarioEncontrado = usuarios.find((item) => {
    return item.usuario === usuario && item.senha === senha;
  });

  if (!usuarioEncontrado) {
    return res.status(401).json({
      mensagem: "Usuário ou senha inválidos."
    });
  }

  res.json({
    mensagem: "Login realizado com sucesso!",
    usuario: {
      id: usuarioEncontrado.id,
      nome: usuarioEncontrado.nome,
      usuario: usuarioEncontrado.usuario,
      perfil: usuarioEncontrado.perfil
    }
  });
});

module.exports = router;
