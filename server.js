const express = require('express');
const mysql = require('mysql2/promise');
const { Web3 } = require('web3');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/sitevnimanie', express.static(path.join(__dirname, 'sitevnimanie')));

const web3 = new Web3('http://127.0.0.1:8545');

let DonationContractABI = [];
let DonationContractAddress = '';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fondvnimanie'
};

let db;

async function initDatabase() {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('✅ Подключение к базе данных установлено');
    await createTables();
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
  }
}

async function createTables() {
  const createDonorsTable = `
    CREATE TABLE IF NOT EXISTS donors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      address VARCHAR(42) UNIQUE NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      is_anonymous BOOLEAN DEFAULT false,
      total_amount DECIMAL(30, 10) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_address (address)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  
  const createProjectsTable = `
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      target_amount DECIMAL(30, 10) NOT NULL,
      image_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  
  const createDonationsTable = `
    CREATE TABLE IF NOT EXISTS donations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      donor_address VARCHAR(42) NOT NULL,
      project_id INT NOT NULL,
      amount DECIMAL(30, 10) NOT NULL,
      transaction_hash VARCHAR(66),
      timestamp BIGINT NOT NULL,
      is_anonymous BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_donor (donor_address),
      INDEX idx_project (project_id),
      INDEX idx_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  
  try {
    await db.execute(createDonorsTable);
    await db.execute(createProjectsTable);
    await db.execute(createDonationsTable);
    console.log('✅ Таблицы в базе данных созданы/проверены');
  } catch (error) {
    console.error('❌ Ошибка создания таблиц:', error.message);
  }
}

async function loadContract() {
  try {
    const contractBuild = require('./build/contracts/DonationContract.json');
    DonationContractABI = contractBuild.abi;
    
    if (process.env.CONTRACT_ADDRESS) {
      DonationContractAddress = process.env.CONTRACT_ADDRESS;
    } else {
      const networks = contractBuild.networks;
      if (networks && Object.keys(networks).length > 0) {
        const firstNetworkKey = Object.keys(networks)[0];
        DonationContractAddress = networks[firstNetworkKey].address;
      }
    }
    
    if (DonationContractAddress) {
      console.log('✅ Смарт-контракт загружен:', DonationContractAddress);
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки контракта:', error.message);
  }
}

app.get('/api/projects', async (req, res) => {
  try {
    const [projects] = await db.execute('SELECT * FROM projects ORDER BY id DESC');
    
    if (DonationContractABI.length > 0 && DonationContractAddress) {
      const contract = new web3.eth.Contract(DonationContractABI, DonationContractAddress);
      const projectCount = await contract.methods.projectCount().call();
      
      for (let i = 1; i <= projectCount; i++) {
        try {
          const projectData = await contract.methods.getProject(i).call();
          const progress = await contract.methods.getProjectProgress(i).call();
          
          const projectIndex = projects.findIndex(p => p.project_id === i);
          if (projectIndex !== -1) {
            projects[projectIndex].collectedAmount = web3.utils.fromWei(projectData.collectedAmount, 'ether');
            projects[projectIndex].targetAmount = web3.utils.fromWei(projectData.targetAmount, 'ether');
            projects[projectIndex].progress = parseInt(progress);
            projects[projectIndex].isActive = projectData.isActive;
          }
        } catch (error) {
          console.error(`Ошибка загрузки проекта ${i}:`, error.message);
        }
      }
    }
    
    res.json(projects);
  } catch (error) {
    console.error('Ошибка получения проектов:', error);
    res.status(500).json({ error: 'Ошибка получения проектов' });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const [projects] = await db.execute('SELECT * FROM projects WHERE project_id = ?', [projectId]);
    
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    const project = projects[0];
    
    if (DonationContractABI.length > 0 && DonationContractAddress) {
      const contract = new web3.eth.Contract(DonationContractABI, DonationContractAddress);
      const projectData = await contract.methods.getProject(projectId).call();
      const progress = await contract.methods.getProjectProgress(projectId).call();
      
      project.collectedAmount = web3.utils.fromWei(projectData.collectedAmount, 'ether');
      project.targetAmount = web3.utils.fromWei(projectData.targetAmount, 'ether');
      project.progress = parseInt(progress);
      project.isActive = projectData.isActive;
    }
    
    res.json(project);
  } catch (error) {
    console.error('Ошибка получения проекта:', error);
    res.status(500).json({ error: 'Ошибка получения проекта' });
  }
});

app.post('/api/donors', async (req, res) => {
  try {
    const { address, firstName, lastName, isAnonymous } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Адрес обязателен' });
    }
    
    const [existing] = await db.execute('SELECT * FROM donors WHERE address = ?', [address]);
    
    if (existing.length > 0) {
      await db.execute(
        'UPDATE donors SET first_name = ?, last_name = ?, is_anonymous = ? WHERE address = ?',
        [firstName || null, lastName || null, isAnonymous || false, address]
      );
    } else {
      await db.execute(
        'INSERT INTO donors (address, first_name, last_name, is_anonymous) VALUES (?, ?, ?, ?)',
        [address, firstName || null, lastName || null, isAnonymous || false]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка сохранения донора:', error);
    res.status(500).json({ error: 'Ошибка сохранения донора' });
  }
});

app.post('/api/donations', async (req, res) => {
  try {
    const { donorAddress, projectId, amount, transactionHash, timestamp, isAnonymous } = req.body;
    
    await db.execute(
      'INSERT INTO donations (donor_address, project_id, amount, transaction_hash, timestamp, is_anonymous) VALUES (?, ?, ?, ?, ?, ?)',
      [donorAddress, projectId, amount, transactionHash || null, timestamp, isAnonymous || false]
    );
    
    const [donor] = await db.execute('SELECT * FROM donors WHERE address = ?', [donorAddress]);
    if (donor.length > 0) {
      await db.execute(
        'UPDATE donors SET total_amount = total_amount + ? WHERE address = ?',
        [amount, donorAddress]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка сохранения пожертвования:', error);
    res.status(500).json({ error: 'Ошибка сохранения пожертвования' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const [donors] = await db.execute(`
      SELECT 
        d.address,
        d.first_name,
        d.last_name,
        d.is_anonymous,
        COALESCE(SUM(dn.amount), 0) as total_amount,
        COUNT(dn.id) as donation_count
      FROM donors d
      LEFT JOIN donations dn ON d.address = dn.donor_address
      WHERE d.is_anonymous = false
      GROUP BY d.address, d.first_name, d.last_name, d.is_anonymous
      ORDER BY total_amount DESC
      LIMIT 100
    `);
    
    res.json(donors);
  } catch (error) {
    console.error('Ошибка получения лидерборда:', error);
    res.status(500).json({ error: 'Ошибка получения лидерборда' });
  }
});

app.get('/api/donations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const [donations] = await db.execute(`
      SELECT 
        dn.*,
        d.first_name,
        d.last_name,
        d.is_anonymous,
        p.name as project_name
      FROM donations dn
      LEFT JOIN donors d ON dn.donor_address = d.address
      LEFT JOIN projects p ON dn.project_id = p.project_id
      ORDER BY dn.timestamp DESC
      LIMIT ?
    `, [limit]);
    
    res.json(donations);
  } catch (error) {
    console.error('Ошибка получения пожертвований:', error);
    res.status(500).json({ error: 'Ошибка получения пожертвований' });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { projectId, name, description, targetAmount, imageUrl } = req.body;
    
    if (!projectId || !name || !targetAmount) {
      return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
    }
    
    await db.execute(
      'INSERT INTO projects (project_id, name, description, target_amount, image_url) VALUES (?, ?, ?, ?, ?)',
      [projectId, name, description || null, targetAmount, imageUrl || null]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка создания проекта:', error);
    res.status(500).json({ error: 'Ошибка создания проекта' });
  }
});

app.get('/api/contract-info', (req, res) => {
  try {
    if (DonationContractABI.length === 0 || !DonationContractAddress) {
      return res.json({
        success: false,
        message: 'Контракт еще не развернут'
      });
    }
    
    res.json({
      success: true,
      address: DonationContractAddress,
      abi: DonationContractABI
    });
  } catch (error) {
    console.error('Ошибка получения информации о контракте:', error);
    res.status(500).json({ error: 'Ошибка получения информации о контракте' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  await initDatabase();
  await loadContract();
  
  app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 API доступен по адресу http://localhost:${PORT}/api\n`);
  });
}

startServer();
