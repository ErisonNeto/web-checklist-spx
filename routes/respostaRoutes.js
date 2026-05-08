const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const dataDir = path.join(__dirname, "../data");
const arquivoRespostas = path.join(dataDir, "respostas.json");
const arquivoProgresso = path.join(dataDir, "progresso.json");
const arquivoUsuarios = path.join(dataDir, "usuarios.json");

function garantirArquivos() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(arquivoRespostas)) {
    fs.writeFileSync(arquivoRespostas, "[]", "utf8");
  }

  if (!fs.existsSync(arquivoProgresso)) {
    fs.writeFileSync(arquivoProgresso, "[]", "utf8");
  }
}

function lerJson(caminho, padrao = []) {
  garantirArquivos();

  if (!fs.existsSync(caminho)) {
    return padrao;
  }

  const conteudo = fs.readFileSync(caminho, "utf8").replace(/^\uFEFF/, "");

  try {
    return JSON.parse(conteudo);
  } catch (erro) {
    return padrao;
  }
}

function salvarJson(caminho, dados) {
  garantirArquivos();
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), "utf8");
}

function atualizarResumo(registro) {
  const totalItens = Number(registro.totalItens) || registro.itens.length;
  const itensConcluidos = registro.itens.filter((item) => item.marcado).length;
  const percentual = totalItens > 0 ? Math.round((itensConcluidos / totalItens) * 100) : 0;

  registro.totalItens = totalItens;
  registro.itensConcluidos = itensConcluidos;
  registro.percentual = percentual;
  registro.status = percentual === 100 ? "Completo" : "Em andamento";

  return registro;
}

function buscarOuCriarProgresso(progresso, dados, agora) {
  const indice = progresso.findIndex((item) => {
    return Number(item.funcionarioId) === Number(dados.funcionarioId)
      && Number(item.checklistId) === Number(dados.checklistId);
  });

  if (indice >= 0) {
    return {
      indice,
      registro: progresso[indice]
    };
  }

  return {
    indice: -1,
    registro: {
      id: Date.now(),
      funcionarioId: dados.funcionarioId,
      funcionario: dados.funcionario || "Não informado",
      usuario: dados.usuario || "Não informado",
      checklistId: dados.checklistId,
      titulo: dados.titulo,
      totalItens: Number(dados.totalItens) || 0,
      itensConcluidos: 0,
      percentual: 0,
      status: "Em andamento",
      itens: [],
      dataCriacao: agora,
      dataAtualizacao: agora
    }
  };
}

router.get("/", (req, res) => {
  const respostas = lerJson(arquivoRespostas, []);
  res.json(respostas);
});

router.get("/progresso/:funcionarioId", (req, res) => {
  const funcionarioId = Number(req.params.funcionarioId);
  const progresso = lerJson(arquivoProgresso, []);

  const progressoFuncionario = progresso.filter((item) => {
    return Number(item.funcionarioId) === funcionarioId;
  });

  res.json(progressoFuncionario);
});

router.get("/conclusoes", (req, res) => {
  const progresso = lerJson(arquivoProgresso, []);
  res.json(progresso);
});

router.get("/dashboard", (req, res) => {
  const progresso = lerJson(arquivoProgresso, []);
  const usuarios = lerJson(arquivoUsuarios, []);

  const total = progresso.length;
  const completos = progresso.filter((item) => item.status === "Completo").length;
  const incompletos = progresso.filter((item) => item.status !== "Completo").length;

  const mediaGeral = total > 0
    ? Math.round(progresso.reduce((soma, item) => soma + (Number(item.percentual) || 0), 0) / total)
    : 0;

  const funcionarios = usuarios.filter((item) => item.perfil === "funcionario");

  const mapa = {};

  funcionarios.forEach((funcionario) => {
    mapa[funcionario.id] = {
      funcionarioId: funcionario.id,
      funcionario: funcionario.nome,
      usuario: funcionario.usuario,
      total: 0,
      completos: 0,
      incompletos: 0,
      somaPercentual: 0,
      media: 0,
      ultimaAtividade: "-"
    };
  });

  progresso.forEach((item) => {
    const chave = item.funcionarioId || item.usuario || item.funcionario;

    if (!mapa[chave]) {
      mapa[chave] = {
        funcionarioId: item.funcionarioId || null,
        funcionario: item.funcionario || "Não informado",
        usuario: item.usuario || "-",
        total: 0,
        completos: 0,
        incompletos: 0,
        somaPercentual: 0,
        media: 0,
        ultimaAtividade: "-"
      };
    }

    mapa[chave].total += 1;
    mapa[chave].somaPercentual += Number(item.percentual) || 0;
    mapa[chave].ultimaAtividade = item.dataAtualizacao || "-";

    if (item.status === "Completo") {
      mapa[chave].completos += 1;
    } else {
      mapa[chave].incompletos += 1;
    }
  });

  const porFuncionario = Object.values(mapa).map((item) => ({
    ...item,
    media: item.total > 0 ? Math.round(item.somaPercentual / item.total) : 0
  }));

  res.json({
    total,
    completos,
    incompletos,
    mediaGeral,
    porFuncionario
  });
});

router.post("/item", (req, res) => {
  const agora = new Date().toLocaleString("pt-BR");

  const progresso = lerJson(arquivoProgresso, []);
  const respostas = lerJson(arquivoRespostas, []);

  const dados = {
    funcionarioId: req.body.funcionarioId,
    funcionario: req.body.funcionario,
    usuario: req.body.usuario,
    checklistId: req.body.checklistId,
    titulo: req.body.titulo,
    totalItens: req.body.totalItens,
    itemIndex: Number(req.body.itemIndex),
    item: req.body.item,
    marcado: Boolean(req.body.marcado)
  };

  if (!dados.funcionarioId || !dados.checklistId || dados.itemIndex < 0 || !dados.item) {
    return res.status(400).json({
      mensagem: "Dados inválidos para salvar item."
    });
  }

  const { indice, registro } = buscarOuCriarProgresso(progresso, dados, agora);

  registro.funcionario = dados.funcionario || registro.funcionario;
  registro.usuario = dados.usuario || registro.usuario;
  registro.titulo = dados.titulo || registro.titulo;
  registro.totalItens = Number(dados.totalItens) || registro.totalItens;
  registro.dataAtualizacao = agora;

  const itemExistente = registro.itens.find((item) => {
    return Number(item.itemIndex) === Number(dados.itemIndex);
  });

  if (itemExistente) {
    itemExistente.marcado = dados.marcado;
    itemExistente.dataConclusao = dados.marcado ? (itemExistente.dataConclusao || agora) : null;
    itemExistente.dataAlteracao = agora;
  } else {
    registro.itens.push({
      itemIndex: dados.itemIndex,
      item: dados.item,
      marcado: dados.marcado,
      dataConclusao: dados.marcado ? agora : null,
      dataAlteracao: agora
    });
  }

  atualizarResumo(registro);

  if (indice >= 0) {
    progresso[indice] = registro;
  } else {
    progresso.push(registro);
  }

  salvarJson(arquivoProgresso, progresso);

  respostas.push({
    id: Date.now(),
    tipo: dados.marcado ? "ITEM_CONCLUIDO" : "ITEM_DESMARCADO",
    funcionarioId: dados.funcionarioId,
    funcionario: dados.funcionario || "Não informado",
    usuario: dados.usuario || "Não informado",
    checklistId: dados.checklistId,
    titulo: dados.titulo,
    itemIndex: dados.itemIndex,
    item: dados.item,
    totalItens: registro.totalItens,
    itensMarcados: registro.itensConcluidos,
    percentual: registro.percentual,
    status: registro.status === "Completo" ? "Completo" : "Incompleto",
    dataHora: agora
  });

  salvarJson(arquivoRespostas, respostas);

  res.status(201).json({
    mensagem: dados.marcado
      ? "Item concluído e salvo com sucesso."
      : "Marcação removida com sucesso.",
    progresso: registro
  });
});

module.exports = router;
