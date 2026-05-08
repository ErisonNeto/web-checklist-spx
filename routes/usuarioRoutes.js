const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const dataDir = path.join(__dirname, "../data");
const arquivoUsuarios = path.join(dataDir, "usuarios.json");

function garantirArquivo() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(arquivoUsuarios)) {
    const usuariosIniciais = [
      {
        id: 1,
        nome: "Supervisor",
        usuario: "admin",
        senha: "123456",
        perfil: "admin"
      },
      {
        id: 2,
        nome: "Funcionário Teste",
        usuario: "funcionario",
        senha: "123456",
        perfil: "funcionario"
      }
    ];

    fs.writeFileSync(arquivoUsuarios, JSON.stringify(usuariosIniciais, null, 2), "utf8");
  }
}

function lerUsuarios() {
  garantirArquivo();

  const conteudo = fs.readFileSync(arquivoUsuarios, "utf8").replace(/^\uFEFF/, "");

  try {
    return JSON.parse(conteudo);
  } catch (erro) {
    return [];
  }
}

function salvarUsuarios(usuarios) {
  garantirArquivo();
  fs.writeFileSync(arquivoUsuarios, JSON.stringify(usuarios, null, 2), "utf8");
}

router.get("/", (req, res) => {
  const usuarios = lerUsuarios();

  const usuariosSemSenha = usuarios.map((usuario) => ({
    id: usuario.id,
    nome: usuario.nome,
    usuario: usuario.usuario,
    perfil: usuario.perfil
  }));

  res.json(usuariosSemSenha);
});

router.post("/", (req, res) => {
  const { nome, usuario, senha, perfil } = req.body;

  if (!nome || !usuario || !senha || !perfil) {
    return res.status(400).json({
      mensagem: "Preencha nome, usuário, senha e perfil."
    });
  }

  if (!["admin", "funcionario"].includes(perfil)) {
    return res.status(400).json({
      mensagem: "Perfil inválido."
    });
  }

  const usuarios = lerUsuarios();

  const usuarioExiste = usuarios.find((item) => {
    return item.usuario.toLowerCase() === usuario.toLowerCase();
  });

  if (usuarioExiste) {
    return res.status(400).json({
      mensagem: "Esse usuário já existe."
    });
  }

  const novoUsuario = {
    id: Date.now(),
    nome,
    usuario,
    senha,
    perfil
  };

  usuarios.push(novoUsuario);
  salvarUsuarios(usuarios);

  res.status(201).json({
    mensagem: "Usuário criado com sucesso!",
    usuario: {
      id: novoUsuario.id,
      nome: novoUsuario.nome,
      usuario: novoUsuario.usuario,
      perfil: novoUsuario.perfil
    }
  });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const usuarios = lerUsuarios();

  const usuarioEncontrado = usuarios.find((item) => Number(item.id) === id);

  if (!usuarioEncontrado) {
    return res.status(404).json({
      mensagem: "Usuário não encontrado."
    });
  }

  if (usuarioEncontrado.perfil === "admin") {
    const totalAdmins = usuarios.filter((item) => item.perfil === "admin").length;

    if (totalAdmins <= 1) {
      return res.status(400).json({
        mensagem: "Não é possível excluir o único supervisor/ADM."
      });
    }
  }

  const atualizados = usuarios.filter((item) => Number(item.id) !== id);
  salvarUsuarios(atualizados);

  res.json({
    mensagem: "Usuário excluído com sucesso."
  });
});

module.exports = router;
