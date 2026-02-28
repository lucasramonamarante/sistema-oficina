const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');

// 1. PRIMEIRO NÓS CRIAMOS O APP! (Essa linha tinha sumido)
const app = express();

// (Deixe esses dois aqui caso você use para receber dados em JSON)
app.use(cors());
app.use(express.json());

// 2. AGORA SIM! Com o app criado, podemos criar a rota principal
app.get('/', (req, res) => {
  res.send('🚀 API do Sistema de Oficina está ONLINE na nuvem Koyeb!');
});

// 🔌 Conexão com o Banco de Dados (Nuvem - Aiven)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'mysql'
});

// 🏗️ Modelos (Tabelas)
const Cliente = sequelize.define('Cliente', {
  nome: { type: DataTypes.STRING, allowNull: false },
  telefone: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING }
});

const Veiculo = sequelize.define('Veiculo', {
  placa: { type: DataTypes.STRING, allowNull: false, unique: true },
  modelo: { type: DataTypes.STRING, allowNull: false },
  marca: { type: DataTypes.STRING },
  ano: { type: DataTypes.INTEGER }
});

const OrdemServico = sequelize.define('OrdemServico', {
  numero_os: { type: DataTypes.STRING, allowNull: false, unique: true },
  descricao: { type: DataTypes.TEXT, allowNull: false },
  valor: { type: DataTypes.DECIMAL(10, 2) },
  data: { type: DataTypes.DATEONLY, defaultValue: Sequelize.NOW },
  // Nossos campos novos:
  mecanico: { type: DataTypes.STRING },
  km_entrada: { type: DataTypes.STRING },
  km_saida: { type: DataTypes.STRING }
});

// 🤝 Relacionamentos
Cliente.hasMany(Veiculo);
Veiculo.belongsTo(Cliente);

Veiculo.hasMany(OrdemServico);
OrdemServico.belongsTo(Veiculo);

// 🔄 Sincroniza com o banco de dados (alter: true atualiza sem apagar dados!)
sequelize.sync({ alter: true })
  .then(() => console.log('✅ Banco de dados na NUVEM sincronizado com sucesso!'))
  .catch(err => console.error('❌ Erro no banco:', err));

// ==========================================
// 🚀 ROTAS (O que o sistema pode fazer)
// ==========================================

app.post('/clientes', async (req, res) => {
  try {
    const cliente = await Cliente.create(req.body);
    res.status(201).json(cliente);
  } catch (erro) { res.status(400).json({ erro: erro.message }); }
});

app.get('/clientes', async (req, res) => {
  const clientes = await Cliente.findAll();
  res.json(clientes);
});

app.post('/veiculos', async (req, res) => {
  try {
    const veiculo = await Veiculo.create(req.body);
    res.status(201).json(veiculo);
  } catch (erro) { res.status(400).json({ erro: erro.message }); }
});

app.get('/veiculos/placa/:placa', async (req, res) => {
  const veiculo = await Veiculo.findOne({ where: { placa: req.params.placa } });
  if (veiculo) { res.json(veiculo); } else { res.status(404).json({ erro: 'Veículo não encontrado' }); }
});

app.post('/ordens-servico', async (req, res) => {
  try {
    const { VeiculoId, descricao, valor, mecanico, km_entrada, km_saida } = req.body;
    
    const anoAtual = new Date().getFullYear();
    const totalOS = await OrdemServico.count();
    const numeroGerado = `${anoAtual}${(totalOS + 1).toString().padStart(4, '0')}`;

    const os = await OrdemServico.create({
      numero_os: numeroGerado,
      VeiculoId,
      descricao,
      valor,
      mecanico,
      km_entrada,
      km_saida
    });
    res.status(201).json(os);
  } catch (erro) { res.status(400).json({ erro: erro.message }); }
});

app.get('/ordens-servico', async (req, res) => {
  try {
    const ordens = await OrdemServico.findAll({
      include: {
        model: Veiculo,
        include: [Cliente]
      },
      order: [['createdAt', 'DESC']]
    });
    res.json(ordens);
  } catch (erro) { res.status(500).json({ erro: 'Erro ao buscar o histórico.' }); }
});

app.delete('/ordens-servico/:id', async (req, res) => {
  await OrdemServico.destroy({ where: { id: req.params.id } });
  res.json({ mensagem: 'OS apagada!' });
});

app.put('/ordens-servico/:id', async (req, res) => {
  await OrdemServico.update(req.body, { where: { id: req.params.id } });
  res.json({ mensagem: 'OS atualizada!' });
});

// Inicia o servidor com a porta dinâmica para o Koyeb
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

