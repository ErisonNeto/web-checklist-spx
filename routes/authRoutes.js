const express = require("express");
const supabase = require("../supabaseClient");

const router = express.Router();

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFKC")
    .replace(/\u200B/g, "")
    .trim()
    .toLowerCase();
}

function normalizarSenha(valor) {
  return String(valor || "")
    .normalize("NFKC")
    .replace(/\u200B/g, "")
    .trim();
}

router.post("/login", async (req, res) => {
  try {
    const usuarioDigitado = normalizarTexto(req.body.usuario);
    const senhaDigitada = normalizarSenha(req.body.senha);

    if (!usuarioDigitado || !senhaDigitada) {
      return res.status(400).json({
        mensagem: "Informe usuário e senha."
      });
    }

    const { data: usuarios, error } = await supabase
      .from("usuarios")
      .select("id, nome, usuario, senha, perfil");

    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao consultar usuários.",
        detalhe: error.message
      });
    }

    const usuarioEncontrado = (usuarios || []).find((item) => {
      return normalizarTexto(item.usuario) === usuarioDigitado;
    });

    if (!usuarioEncontrado) {
      return res.status(401).json({
        mensagem: "Usuário não encontrado."
      });
    }

    if (normalizarSenha(usuarioEncontrado.senha) !== senhaDigitada) {
      return res.status(401).json({
        mensagem: "Senha inválida."
      });
    }

    return res.json({
      mensagem: "Login realizado com sucesso!",
      usuario: {
        id: usuarioEncontrado.id,
        nome: usuarioEncontrado.nome,
        usuario: usuarioEncontrado.usuario,
        perfil: usuarioEncontrado.perfil
      }
    });
  } catch (erro) {
    return res.status(500).json({
      mensagem: "Erro interno no login.",
      detalhe: erro.message
    });
  }
});

module.exports = router;