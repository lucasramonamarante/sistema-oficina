const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const bcrypt = require('bcryptjs'); // 🔒 Adicionado para criptografar a senha do admin

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const IMGBB_API_KEY = '75f4d0f49c995f73237ab9a2f6e4a177';

// Conexão Segura com o Banco (Aiven via Koyeb)
const sequelize = new Sequelize(process.env.DATABASE_URL, { 
    dialect: 'mysql',
    logging: false 
});

// ==========================================
// 🏗️ Modelos do Banco de Dados
// ==========================================

// 🔒 Tabela do Administrador (Para o Login do Dono)
const Admin = sequelize.define('Admin', {
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    senha: { type: DataTypes.STRING, allowNull: false }
});

const Cliente = sequelize.define('Cliente', {
    nome: { type: DataTypes.STRING, allowNull: false },
    telefone: { type: DataTypes.STRING, allowNull: false, unique: true }, // 🔒 TRAVA NO TELEFONE
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
    foto_1: { type: DataTypes.STRING }, foto_2: { type: DataTypes.STRING },
    foto_3: { type: DataTypes.STRING }, foto_4: { type: DataTypes.STRING },
    foto_5: { type: DataTypes.STRING }, foto_6: { type: DataTypes.STRING },
    foto_7: { type: DataTypes.STRING }, foto_8: { type: DataTypes.STRING }
});

// Associações
Cliente.hasMany(Veiculo);
Veiculo.belongsTo(Cliente);
Veiculo.hasMany(OrdemServico);
OrdemServico.belongsTo(Veiculo);

sequelize.sync({ alter: true })
    .then(() => console.log('✅ Banco de Dados Sincronizado e Pronto!'))
    .catch(err => console.error('❌ Erro ao sincronizar banco:', err));

// ==========================================
// 🚀 ROTAS (Caminhos do Servidor)
// ==========================================

app.get('/', (req, res) => {
    res.send('🚀 API Garagem 184 PRO - Online e Completa!');
});

// --- ROTAS DE AUTENTICAÇÃO (LOGIN) ---

// 1. Rota para CRIAR o administrador (O cliente vai usar isso só 1 vez)
app.post('/setup-admin', async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        // Verifica se já existe um admin (para não deixar criarem mais de um)
        const adminExistente = await Admin.findOne();
        if (adminExistente) {
            return res.status(400).json({ erro: 'O administrador já foi criado!' });
        }

        // Embaralha a senha antes de salvar
        const salt = await bcrypt.genSalt(10);
        const senhaCriptografada = await bcrypt.hash(senha, salt);

        await Admin.create({ email, senha: senhaCriptografada });
        res.status(201).json({ mensagem: '✅ Conta de administrador criada com sucesso!' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao criar administrador.' });
    }
});

// 2. Rota de LOGIN (Vai conferir se a senha bate com a do banco)
app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        // Procura o email no banco
        const admin = await Admin.findOne({ where: { email } });
        if (!admin) {
            return res.status(404).json({ erro: 'E-mail não encontrado.' });
        }

        // Compara a senha digitada com a senha embaralhada do banco
        const senhaCorreta = await bcrypt.compare(senha, admin.senha);
        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'Senha incorreta!' });
        }

        // Se deu tudo certo, libera o acesso
        res.status(200).json({ mensagem: 'Login aprovado!', token: 'acesso-liberado-garagem184' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro no servidor.' });
    }
});

// --- ROTAS DE CLIENTES ---
app.post('/clientes', async (req, res) => {
    try { 
        const c = await Cliente.create(req.body); 
        res.status(201).json(c); 
    } catch (e) { 
        // 🔒 TRAVA BLINDADA: Se o banco avisar que o telefone já existe, manda o erro pro site!
        if (e.name === 'SequelizeUniqueConstraintError') {
            res.status(400).json({ erro: 'Este TELEFONE já está cadastrado no sistema!' });
        } else {
            res.status(400).json({ erro: 'Erro ao criar cliente' }); 
        }
    }
});

app.get('/clientes', async (req, res) => {
    // ATUALIZAÇÃO: Agora o banco de dados já devolve os clientes organizados em Ordem Alfabética (A-Z)
    const lista = await Cliente.findAll({
        order: [['nome', 'ASC']]
    }); 
    res.json(lista);
});

// --- ROTAS DE VEÍCULOS ---
app.post('/veiculos', async (req, res) => {
    try { const v = await Veiculo.create(req.body); res.status(201).json(v); }
    catch (e) { res.status(400).json({ erro: 'Placa já cadastrada ou erro nos dados.' }); }
});

// 🔍 ESSA É A ROTA QUE ESTAVA FALTANDO (Erro 404)!
app.get('/veiculos/placa/:placa', async (req, res) => {
    try {
        const v = await Veiculo.findOne({ where: { placa: req.params.placa } });
        if (v) res.json(v);
        else res.status(404).json({ erro: 'Veículo não encontrado.' });
    } catch (e) { res.status(500).json({ erro: 'Erro no servidor.' }); }
});

// --- ROTAS DE ORDEM DE SERVIÇO (Com Fotos) ---
app.post('/ordens-servico', upload.array('fotos', 8), async (req, res) => {
    try {
        const { VeiculoId, descricao, valor, mecanico, km_entrada, km_saida } = req.body;
        const files = req.files || [];
        const linksFotos = [];

        for (const file of files) {
            const form = new FormData();
            form.append('image', file.buffer.toString('base64'));
            const response = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, form);
            linksFotos.push(response.data.data.url);
        }

        const totalOS = await OrdemServico.count();
        const numeroGerado = `${new Date().getFullYear()}${(totalOS + 1).toString().padStart(4, '0')}`;

        const os = await OrdemServico.create({
            numero_os: numeroGerado, VeiculoId, descricao, valor, mecanico, km_entrada, km_saida,
            foto_1: linksFotos[0] || null, foto_2: linksFotos[1] || null,
            foto_3: linksFotos[2] || null, foto_4: linksFotos[3] || null,
            foto_5: linksFotos[4] || null, foto_6: linksFotos[5] || null,
            foto_7: linksFotos[6] || null, foto_8: linksFotos[7] || null
        });
        res.status(201).json(os);
    } catch (erro) {
        console.error(erro);
        res.status(400).json({ erro: 'Erro ao criar OS.' });
    }
});

app.get('/ordens-servico', async (req, res) => {
    const ordens = await OrdemServico.findAll({ 
        include: { model: Veiculo, include: [Cliente] }, 
        order: [['createdAt', 'DESC']] 
    });
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
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));