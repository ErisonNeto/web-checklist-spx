const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const dataDir = path.join(__dirname, "../data");
const arquivoChecklists = path.join(dataDir, "checklists.json");

function garantirArquivo() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(arquivoChecklists)) {
    const iniciais = [
      {
        id: 1,
        titulo: "Checklist de Entrada do Funcionário",
        setor: "Operação",
        descricao: "Conferência inicial antes do início da atividade.",
        funcionarioId: null,
        funcionarioNome: "Todos",
        ativo: true,
        itens: [
          "Está usando uniforme completo?",
          "Está usando crachá?",
          "Está usando EPI obrigatório?",
          "Recebeu orientação do líder?",
          "Está apto para iniciar a atividade?"
        ],
        dataCriacao: new Date().toLocaleString("pt-BR")
      },
      {
        id: 2,
        titulo: "Checklist de Saída do Funcionário",
        setor: "Operação",
        descricao: "Conferência ao finalizar o turno.",
        funcionarioId: null,
        funcionarioNome: "Todos",
        ativo: true,
        itens: [
          "Finalizou as atividades do turno?",
          "Organizou o posto de trabalho?",
          "Informou pendências ao líder?",
          "Devolveu equipamentos utilizados?",
          "Registrou ocorrência, se houver?"
        ],
        dataCriacao: new Date().toLocaleString("pt-BR")
      }
    ];

    fs.writeFileSync(arquivoChecklists, JSON.stringify(iniciais, null, 2), "utf8");
  }
}

function lerChecklists() {
  garantirArquivo();

  const conteudo = fs.readFileSync(arquivoChecklists, "utf8").replace(/^\uFEFF/, "");

  try {
    return JSON.parse(conteudo);
  } catch (erro) {
    return [];
  }
}

function salvarChecklists(checklists) {
  garantirArquivo();
  fs.writeFileSync(arquivoChecklists, JSON.stringify(checklists, null, 2), "utf8");
}

router.get("/", (req, res) => {
  const funcionarioId = req.query.funcionarioId ? Number(req.query.funcionarioId) : null;
  let checklists = lerChecklists();

  checklists = checklists.filter((item) => item.ativo !== false);

  if (funcionarioId) {
    checklists = checklists.filter((item) => {
      return !item.funcionarioId || Number(item.funcionarioId) === funcionarioId;
    });
  }

  res.json(checklists);
});

router.post("/", (req, res) => {
  const { titulo, setor, descricao, funcionarioId, funcionarioNome } = req.body;

  let itens = req.body.itens || [];

  if (typeof itens === "string") {
    itens = itens
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (!titulo || !setor || itens.length === 0) {
    return res.status(400).json({
      mensagem: "Preencha título, setor e pelo menos um item."
    });
  }

  const checklists = lerChecklists();

  const novoChecklist = {
    id: Date.now(),
    titulo,
    setor,
    descricao: descricao || "",
    funcionarioId: funcionarioId ? Number(funcionarioId) : null,
    funcionarioNome: funcionarioNome || "Todos",
    ativo: true,
    itens,
    dataCriacao: new Date().toLocaleString("pt-BR")
  };

  checklists.push(novoChecklist);
  salvarChecklists(checklists);

  res.status(201).json({
    mensagem: "Atividade criada com sucesso!",
    checklist: novoChecklist
  });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const checklists = lerChecklists();

  const existe = checklists.find((item) => Number(item.id) === id);

  if (!existe) {
    return res.status(404).json({
      mensagem: "Atividade não encontrada."
    });
  }

  const atualizados = checklists.filter((item) => Number(item.id) !== id);
  salvarChecklists(atualizados);

  res.json({
    mensagem: "Atividade excluída com sucesso."
  });
});

module.exports = router;
