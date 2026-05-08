const express = require("express");
const supabase = require("../supabaseClient");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const usuario = String(req.body.usuario || "").trim();
    const senha = String(req.body.senha || "").trim();

    if (!usuario || !senha) {
      return res.status(400).json({
        mensagem: "Informe usuário e senha."
      });
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, usuario, senha, perfil")
      .eq("usuario", usuario)
      .eq("senha", senha)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao consultar usuário.",
        detalhe: error.message
      });
    }

    if (!data) {
      return res.status(401).json({
        mensagem: "Usuário ou senha inválidos."
      });
    }

    res.json({
      mensagem: "Login realizado com sucesso!",
      usuario: {
        id: data.id,
        nome: data.nome,
        usuario: data.usuario,
        perfil: data.perfil
      }
    });
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro interno no login.",
      detalhe: erro.message
    });
  }
});

module.exports = router;