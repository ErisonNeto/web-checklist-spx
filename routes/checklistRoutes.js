const express = require("express");
const supabase = require("../supabaseClient");

const router = express.Router();

function montarChecklist(checklist, itens) {
  const itensDoChecklist = itens
    .filter((item) => Number(item.checklist_id) === Number(checklist.id))
    .sort((a, b) => Number(a.item_index) - Number(b.item_index));

  return {
    id: checklist.id,
    titulo: checklist.titulo,
    setor: checklist.setor,
    descricao: checklist.descricao || "",
    funcionarioId: checklist.funcionario_id || null,
    funcionarioNome: checklist.funcionario_nome || "Todos",
    ativo: checklist.ativo,
    itens: itensDoChecklist.map((item) => item.texto),
    dataCriacao: checklist.criado_em
  };
}

router.get("/", async (req, res) => {
  try {
    const funcionarioId = req.query.funcionarioId
      ? Number(req.query.funcionarioId)
      : null;

    let query = supabase
      .from("checklists")
      .select("id, titulo, setor, descricao, funcionario_id, funcionario_nome, ativo, criado_em")
      .eq("ativo", true)
      .order("id", { ascending: true });

    if (funcionarioId) {
      query = query.or(`funcionario_id.is.null,funcionario_id.eq.${funcionarioId}`);
    }

    const { data: checklists, error } = await query;

    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao buscar checklists.",
        detalhe: error.message
      });
    }

    if (!checklists || checklists.length === 0) {
      return res.json([]);
    }

    const ids = checklists.map((item) => item.id);

    const { data: itens, error: erroItens } = await supabase
      .from("checklist_itens")
      .select("id, checklist_id, item_index, texto")
      .in("checklist_id", ids)
      .order("item_index", { ascending: true });

    if (erroItens) {
      return res.status(500).json({
        mensagem: "Erro ao buscar itens dos checklists.",
        detalhe: erroItens.message
      });
    }

    const resultado = checklists.map((checklist) => {
      return montarChecklist(checklist, itens || []);
    });

    res.json(resultado);
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro interno ao listar checklists.",
      detalhe: erro.message
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const titulo = String(req.body.titulo || "").trim();
    const setor = String(req.body.setor || "").trim();
    const descricao = String(req.body.descricao || "").trim();
    const funcionarioId = req.body.funcionarioId ? Number(req.body.funcionarioId) : null;
    const funcionarioNome = req.body.funcionarioNome || "Todos";

    let itens = req.body.itens || [];

    if (typeof itens === "string") {
      itens = itens
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (!titulo || !setor || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({
        mensagem: "Preencha título, setor e pelo menos um item."
      });
    }

    const { data: checklist, error } = await supabase
      .from("checklists")
      .insert([
        {
          titulo,
          setor,
          descricao,
          funcionario_id: funcionarioId,
          funcionario_nome: funcionarioNome,
          ativo: true
        }
      ])
      .select("id, titulo, setor, descricao, funcionario_id, funcionario_nome, ativo, criado_em")
      .single();

    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao criar atividade.",
        detalhe: error.message
      });
    }

    const itensParaInserir = itens.map((texto, index) => ({
      checklist_id: checklist.id,
      item_index: index,
      texto
    }));

    const { error: erroItens } = await supabase
      .from("checklist_itens")
      .insert(itensParaInserir);

    if (erroItens) {
      return res.status(500).json({
        mensagem: "Atividade criada, mas houve erro ao salvar os itens.",
        detalhe: erroItens.message
      });
    }

    res.status(201).json({
      mensagem: "Atividade criada com sucesso!",
      checklist: {
        id: checklist.id,
        titulo: checklist.titulo,
        setor: checklist.setor,
        descricao: checklist.descricao || "",
        funcionarioId: checklist.funcionario_id || null,
        funcionarioNome: checklist.funcionario_nome || "Todos",
        ativo: checklist.ativo,
        itens,
        dataCriacao: checklist.criado_em
      }
    });
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro interno ao criar checklist.",
      detalhe: erro.message
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        mensagem: "ID inválido."
      });
    }

    const { error } = await supabase
      .from("checklists")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao excluir atividade.",
        detalhe: error.message
      });
    }

    res.json({
      mensagem: "Atividade excluída com sucesso."
    });
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro interno ao excluir checklist.",
      detalhe: erro.message
    });
  }
});

module.exports = router;