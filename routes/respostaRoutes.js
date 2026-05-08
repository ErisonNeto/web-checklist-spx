const express = require("express");
const supabase = require("../supabaseClient");

const router = express.Router();

function dataHojeBR() {
  const agora = new Date();

  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(agora);

  const dia = partes.find((p) => p.type === "day").value;
  const mes = partes.find((p) => p.type === "month").value;
  const ano = partes.find((p) => p.type === "year").value;

  return `${ano}-${mes}-${dia}`;
}

function dataHoraBR(valor) {
  if (!valor) return "-";

  return new Date(valor).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });
}

async function buscarOuCriarProgresso(dados, dataReferencia) {
  const { data: existente, error: erroBusca } = await supabase
    .from("progresso_diario")
    .select("*")
    .eq("data_referencia", dataReferencia)
    .eq("funcionario_id", dados.funcionarioId)
    .eq("checklist_id", dados.checklistId)
    .maybeSingle();

  if (erroBusca) {
    throw new Error(erroBusca.message);
  }

  if (existente) {
    return existente;
  }

  const { data: criado, error: erroCriar } = await supabase
    .from("progresso_diario")
    .insert([
      {
        data_referencia: dataReferencia,
        funcionario_id: dados.funcionarioId,
        funcionario: dados.funcionario || "Não informado",
        usuario: dados.usuario || "Não informado",
        checklist_id: dados.checklistId,
        titulo: dados.titulo,
        total_itens: Number(dados.totalItens) || 0,
        itens_concluidos: 0,
        percentual: 0,
        status: "Em andamento"
      }
    ])
    .select("*")
    .single();

  if (erroCriar) {
    throw new Error(erroCriar.message);
  }

  return criado;
}

async function recalcularProgresso(progressoId, totalItens) {
  const { data: itens, error: erroItens } = await supabase
    .from("progresso_itens")
    .select("*")
    .eq("progresso_id", progressoId);

  if (erroItens) {
    throw new Error(erroItens.message);
  }

  const itensConcluidos = (itens || []).filter((item) => item.marcado).length;
  const percentual = totalItens > 0 ? Math.round((itensConcluidos / totalItens) * 100) : 0;
  const status = percentual === 100 ? "Completo" : "Em andamento";

  const { data: atualizado, error: erroAtualizar } = await supabase
    .from("progresso_diario")
    .update({
      total_itens: totalItens,
      itens_concluidos: itensConcluidos,
      percentual,
      status,
      atualizado_em: new Date().toISOString()
    })
    .eq("id", progressoId)
    .select("*")
    .single();

  if (erroAtualizar) {
    throw new Error(erroAtualizar.message);
  }

  return atualizado;
}

function formatarProgresso(item, itens = []) {
  return {
    id: item.id,
    dataReferencia: item.data_referencia,
    funcionarioId: item.funcionario_id,
    funcionario: item.funcionario,
    usuario: item.usuario,
    checklistId: item.checklist_id,
    titulo: item.titulo,
    totalItens: item.total_itens,
    itensConcluidos: item.itens_concluidos,
    percentual: item.percentual,
    status: item.status,
    dataCriacao: dataHoraBR(item.criado_em),
    dataAtualizacao: dataHoraBR(item.atualizado_em),
    itens: itens.map((i) => ({
      itemIndex: i.item_index,
      item: i.item,
      marcado: i.marcado,
      dataConclusao: dataHoraBR(i.data_conclusao),
      dataAlteracao: dataHoraBR(i.atualizado_em)
    }))
  };
}

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("historico_respostas")
      .select("*")
      .order("data_hora", { ascending: true });

    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao buscar histórico.",
        detalhe: error.message
      });
    }

    const resultado = (data || []).map((item) => ({
      id: item.id,
      tipo: item.tipo,
      dataReferencia: item.data_referencia,
      funcionarioId: item.funcionario_id,
      funcionario: item.funcionario,
      usuario: item.usuario,
      checklistId: item.checklist_id,
      titulo: item.titulo,
      itemIndex: item.item_index,
      item: item.item,
      totalItens: item.total_itens,
      itensMarcados: item.itens_marcados,
      percentual: item.percentual,
      status: item.status,
      dataHora: dataHoraBR(item.data_hora)
    }));

    res.json(resultado);
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro interno ao buscar histórico.",
      detalhe: erro.message
    });
  }
});

router.get("/progresso/:funcionarioId", async (req, res) => {
  try {
    const funcionarioId = Number(req.params.funcionarioId);
    const dataReferencia = req.query.data || dataHojeBR();

    const { data: progressos, error } = await supabase
      .from("progresso_diario")
      .select("*")
      .eq("funcionario_id", funcionarioId)
      .eq("data_referencia", dataReferencia);

    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao buscar progresso.",
        detalhe: error.message
      });
    }

    if (!progressos || progressos.length === 0) {
      return res.json([]);
    }

    const ids = progressos.map((item) => item.id);

    const { data: itens, error: erroItens } = await supabase
      .from("progresso_itens")
      .select("*")
      .in("progresso_id", ids)
      .order("item_index", { ascending: true });

    if (erroItens) {
      return res.status(500).json({
        mensagem: "Erro ao buscar itens do progresso.",
        detalhe: erroItens.message
      });
    }

    const resultado = progressos.map((progresso) => {
      const itensDoProgresso = (itens || []).filter((item) => {
        return Number(item.progresso_id) === Number(progresso.id);
      });

      return formatarProgresso(progresso, itensDoProgresso);
    });

    res.json(resultado);
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro interno ao buscar progresso.",
      detalhe: erro.message
    });
  }
});

router.get("/conclusoes", async (req, res) => {
  try {
    const dataReferencia = req.query.data || dataHojeBR();

    const { data, error } = await supabase
      .from("progresso_diario")
      .select("*")
      .eq("data_referencia", dataReferencia)
      .order("atualizado_em", { ascending: true });

    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao buscar conclusões.",
        detalhe: error.message
      });
    }

    const resultado = (data || []).map((item) => formatarProgresso(item, []));

    res.json(resultado);
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro interno ao buscar conclusões.",
      detalhe: erro.message
    });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const dataReferencia = req.query.data || dataHojeBR();

    const { data: progressos, error } = await supabase
      .from("progresso_diario")
      .select("*")
      .eq("data_referencia", dataReferencia);

    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao buscar dashboard.",
        detalhe: error.message
      });
    }

    const { data: usuarios, error: erroUsuarios } = await supabase
      .from("usuarios")
      .select("id, nome, usuario, perfil")
      .eq("perfil", "funcionario");

    if (erroUsuarios) {
      return res.status(500).json({
        mensagem: "Erro ao buscar funcionários.",
        detalhe: erroUsuarios.message
      });
    }

    const lista = progressos || [];

    const total = lista.length;
    const completos = lista.filter((item) => item.status === "Completo").length;
    const incompletos = lista.filter((item) => item.status !== "Completo").length;

    const mediaGeral = total > 0
      ? Math.round(lista.reduce((soma, item) => soma + (Number(item.percentual) || 0), 0) / total)
      : 0;

    const mapa = {};

    (usuarios || []).forEach((funcionario) => {
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

    lista.forEach((item) => {
      const chave = item.funcionario_id;

      if (!mapa[chave]) {
        mapa[chave] = {
          funcionarioId: item.funcionario_id,
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
      mapa[chave].ultimaAtividade = dataHoraBR(item.atualizado_em);

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
      dataReferencia,
      total,
      completos,
      incompletos,
      mediaGeral,
      porFuncionario
    });
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro interno ao gerar dashboard.",
      detalhe: erro.message
    });
  }
});

router.post("/item", async (req, res) => {
  try {
    const dataReferencia = req.body.dataReferencia || dataHojeBR();

    const dados = {
      funcionarioId: Number(req.body.funcionarioId),
      funcionario: req.body.funcionario || "Não informado",
      usuario: req.body.usuario || "Não informado",
      checklistId: Number(req.body.checklistId),
      titulo: req.body.titulo,
      totalItens: Number(req.body.totalItens) || 0,
      itemIndex: Number(req.body.itemIndex),
      item: req.body.item,
      marcado: Boolean(req.body.marcado)
    };

    if (!dados.funcionarioId || !dados.checklistId || dados.itemIndex < 0 || !dados.item) {
      return res.status(400).json({
        mensagem: "Dados inválidos para salvar item."
      });
    }

    const progresso = await buscarOuCriarProgresso(dados, dataReferencia);

    const { error: erroItem } = await supabase
      .from("progresso_itens")
      .upsert(
        [
          {
            progresso_id: progresso.id,
            item_index: dados.itemIndex,
            item: dados.item,
            marcado: dados.marcado,
            data_conclusao: dados.marcado ? new Date().toISOString() : null,
            atualizado_em: new Date().toISOString()
          }
        ],
        {
          onConflict: "progresso_id,item_index"
        }
      );

    if (erroItem) {
      return res.status(500).json({
        mensagem: "Erro ao salvar item.",
        detalhe: erroItem.message
      });
    }

    const progressoAtualizado = await recalcularProgresso(
      progresso.id,
      dados.totalItens
    );

    const { error: erroHistorico } = await supabase
      .from("historico_respostas")
      .insert([
        {
          data_referencia: dataReferencia,
          tipo: dados.marcado ? "ITEM_CONCLUIDO" : "ITEM_DESMARCADO",
          funcionario_id: dados.funcionarioId,
          funcionario: dados.funcionario,
          usuario: dados.usuario,
          checklist_id: dados.checklistId,
          titulo: dados.titulo,
          item_index: dados.itemIndex,
          item: dados.item,
          total_itens: progressoAtualizado.total_itens,
          itens_marcados: progressoAtualizado.itens_concluidos,
          percentual: progressoAtualizado.percentual,
          status: progressoAtualizado.status === "Completo" ? "Completo" : "Incompleto"
        }
      ]);

    if (erroHistorico) {
      return res.status(500).json({
        mensagem: "Item salvo, mas houve erro ao registrar histórico.",
        detalhe: erroHistorico.message
      });
    }

    res.status(201).json({
      mensagem: dados.marcado
        ? "Item concluído e salvo com sucesso."
        : "Marcação removida com sucesso.",
      progresso: formatarProgresso(progressoAtualizado, [])
    });
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro interno ao salvar item.",
      detalhe: erro.message
    });
  }
});

module.exports = router;