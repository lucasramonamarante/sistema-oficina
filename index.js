const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Multer (recebe as fotos na memória temporariamente)
const upload = multer({ storage: multer.memoryStorage() });

// 🔑 SUA CHAVE DO IMGBB
const IMGBB_API_KEY = '75f4d0f49c995f73237ab9a2f6e4a177';

app.get('/', (req, res) => {
  res.send('🚀 API Garagem 184 PRO - Online e Pronta para Fotos!');
});

const sequelize = new Sequelize(process.env.DATABASE_URL, { dialect: 'mysql' });

// ==========================================
// 🏗️ Modelos
// ==========================================
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
  mecanico: { type: DataTypes.STRING },
  km_entrada: { type: DataTypes.STRING },
  km_saida: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'Orçamento' },
  // Links das 8 fotos
  foto_1: { type: DataTypes.STRING }, foto_2: { type: DataTypes.STRING },
  foto_3: { type: DataTypes.STRING }, foto_4: { type: DataTypes.STRING },
  foto_5: { type: DataTypes.STRING }, foto_6: { type: DataTypes.STRING },
  foto_7: { type: DataTypes.STRING }, foto_8: { type: DataTypes.STRING }
});

Cliente.hasMany(Veiculo);
Veiculo.belongsTo(Cliente);
Veiculo.hasMany(OrdemServico);
OrdemServico.belongsTo(Veiculo);

sequelize.sync({ alter: true })
  .then(() => console.log('✅ Banco sincronizado (Fotos e Status ativos)'))
  .catch(err => console.error('❌ Erro no banco:', err));

// ==========================================
// 🚀 ROTAS
// ==========================================

// ROTA NOVA: Criar OS com 8 Fotos (Upload Múltiplo)
app.post('/ordens-servico', upload.array('fotos', 8), async (req, res) => {
  try {
    const { VeiculoId, descricao, valor, mecanico, km_entrada, km_saida } = req.body;
    const files = req.files;
    const linksFotos = [];

    // Envia cada foto para o ImgBB
    for (const file of files) {
      const form = new FormData();
      form.append('image', file.buffer.toString('base64'));
      const response = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, form);
      linksFotos.push(response.data.data.url);
    }

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
      km_saida,
      // Preenche os campos de foto com os links recebidos
      foto_1: linksFotos[0] || null,
      foto_2: linksFotos[1] || null,
      foto_3: linksFotos[2] || null,
      foto_4: linksFotos[3] || null,
      foto_5: linksFotos[4] || null,
      foto_6: linksFotos[5] || null,
      foto_7: linksFotos[6] || null,
      foto_8: linksFotos[7] || null
    });

    res.status(201).json(os);
  } catch (erro) {
    console.error(erro);
    res.status(400).json({ erro: 'Erro ao criar OS com fotos.' });
  }
});

// Outras rotas permanecem iguais
app.get('/ordens-servico', async (req, res) => {
  const ordens = await OrdemServico.findAll({ include: { model: Veiculo, include: [Cliente] }, order: [['createdAt', 'DESC']] });
  res.json(ordens);
});

app.delete('/ordens-servico/:id', async (req, res) => {
  await OrdemServico.destroy({ where: { id: req.params.id } });
  res.json({ mensagem: 'OS apagada!' });
});

app.put('/ordens-servico/:id', async (req, res) => {
  await OrdemServico.update(req.body, { where: { id: req.params.id } });
  res.json({ mensagem: 'OS atualizada!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));