const API_URL = 'http://localhost:3000/api';

let web3;
let contract;
let contractAddress = '';
let contractABI = [];
let currentAccount = null;

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', async (accounts) => {
            currentAccount = accounts.length > 0 ? accounts[0] : null;
            await updateWalletUI();
        });
        
        window.ethereum.on('chainChanged', async () => {
            // Смена сети обрабатывается автоматически
        });
        
        web3 = new Web3(window.ethereum);
        
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                currentAccount = accounts[0];
                await updateWalletUI();
            }
        } catch (error) {
            console.error('Ошибка проверки аккаунтов:', error);
        }
        
        await loadContractInfo();
    }
    
    await loadProjects();
    await loadLeaderboard();
    await loadDonationsHistory();
    await showContractInfo();
    setupEventHandlers();
});

async function loadContractInfo() {
    try {
        const response = await fetch(`${API_URL}/contract-info`);
        const data = await response.json();
        
        if (data.success) {
            contractAddress = data.address;
            contractABI = data.abi;
            
            if (!web3) {
                if (typeof window.ethereum !== 'undefined') {
                    web3 = new Web3(window.ethereum);
                } else {
                    web3 = new Web3('http://127.0.0.1:8545');
                }
            }
            
            if (contractAddress && contractABI.length > 0 && web3) {
                contract = new web3.eth.Contract(contractABI, contractAddress);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки контракта:', error);
    }
}

async function connectWallet() {
    try {
        let ethereumProvider = null;
        
        if (window.ethereum) {
            ethereumProvider = window.ethereum;
        } else if (window.web3) {
            ethereumProvider = window.web3.currentProvider;
        } else {
            showManualWalletInput();
            return;
        }
        
        const accounts = await ethereumProvider.request({ method: 'eth_requestAccounts' });
        currentAccount = accounts[0];
        
        if (window.ethereum) {
            web3 = new Web3(window.ethereum);
        } else {
            web3 = new Web3(ethereumProvider);
        }
        
        updateWalletUI();
    } catch (error) {
        console.error('Ошибка подключения кошелька:', error);
        if (error.code === 4001 || error.code === -32002) {
            showManualWalletInput();
        } else {
            alert('Ошибка подключения кошелька. Можете ввести адрес вручную.');
            showManualWalletInput();
        }
    }
}

function showManualWalletInput() {
    document.getElementById('connectWalletBtn').style.display = 'none';
    document.getElementById('manualWalletBtn').style.display = 'inline-block';
    document.getElementById('manualWalletInput').style.display = 'block';
}

function saveManualAddress() {
    const address = document.getElementById('manualAddressInput').value.trim();
    
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        alert('Введите корректный адрес Ethereum');
        return;
    }
    
    currentAccount = address;
    
    if (!web3) {
        web3 = new Web3('http://127.0.0.1:8545');
    }
    
    updateWalletUI();
    document.getElementById('manualWalletInput').style.display = 'none';
    document.getElementById('manualWalletBtn').style.display = 'none';
}


async function updateWalletUI() {
    const connectBtn = document.getElementById('connectWalletBtn');
    const manualBtn = document.getElementById('manualWalletBtn');
    const walletAddress = document.getElementById('walletAddress');
    const manualInput = document.getElementById('manualWalletInput');
    
    if (currentAccount) {
        connectBtn.style.display = 'none';
        manualBtn.style.display = 'none';
        manualInput.style.display = 'none';
        walletAddress.textContent = `${currentAccount.substring(0, 6)}...${currentAccount.substring(38)}`;
        walletAddress.style.display = 'inline-block';
        
    } else {
        connectBtn.style.display = 'inline-block';
        walletAddress.style.display = 'none';
        manualInput.style.display = 'none';
    }
}

async function loadProjects() {
    try {
        const response = await fetch(`${API_URL}/projects`);
        const projects = await response.json();
        
        const projectsList = document.getElementById('projectsList');
        
        if (projects.length === 0) {
            projectsList.innerHTML = '<div class="no-projects">Проекты пока не добавлены</div>';
            return;
        }
        
        const projectSelect = document.getElementById('projectSelect');
        projectSelect.innerHTML = '<option value="">Выберите проект</option>';
        
        projects.forEach((project) => {
            const option = document.createElement('option');
            option.value = project.project_id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });
        
        let totalRaised = 0;
        let totalGoal = 0;
        let activeCount = 0;
        
        projectsList.innerHTML = projects.map(project => {
            const collected = parseFloat(project.collectedAmount || 0);
            const target = parseFloat(project.targetAmount || 0);
            const progress = target > 0 ? Math.min((collected / target) * 100, 100) : 0;
            
            totalRaised += collected;
            totalGoal += target;
            if (project.isActive) activeCount++;
            
            return `
                <div class="project-card clickable-project" data-project-id="${project.project_id}" data-project-name="${project.name}">
                    <div class="project-image">
                        ${project.image_url ? `<img src="${project.image_url}" alt="${project.name}">` : '<div class="project-placeholder">Фото</div>'}
                    </div>
                    <div class="project-content">
                        <h3 class="project-title">${project.name}</h3>
                        ${project.description ? `<p class="project-description">${project.description}</p>` : ''}
                        <div class="project-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <div class="project-stats">
                                <span class="collected">${collected.toFixed(2)} ETH</span>
                                <span class="target">из ${target.toFixed(2)} ETH</span>
                                <span class="percent">${progress.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('totalRaised').textContent = totalRaised.toFixed(2);
        document.getElementById('totalGoal').textContent = totalGoal.toFixed(2);
        document.getElementById('activeProjects').textContent = activeCount;
        
        setTimeout(() => {
            setupProjectCardClickHandlers();
        }, 100);
        
    } catch (error) {
        console.error('Ошибка загрузки проектов:', error);
        document.getElementById('projectsList').innerHTML = '<div class="error">Ошибка загрузки проектов</div>';
    }
}

function selectProjectForDonation(projectId, projectName) {
    const projectSelect = document.getElementById('projectSelect');
    const amountInput = document.getElementById('amount');
    
    if (projectSelect && amountInput) {
        projectSelect.value = projectId;
        amountInput.value = '0.01';
        
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach(card => {
            card.classList.remove('selected-project');
            if (card.dataset.projectId == projectId) {
                card.classList.add('selected-project');
            }
        });
        
        const donateSection = document.getElementById('donate');
        if (donateSection) {
            donateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        setTimeout(() => {
            amountInput.focus();
            amountInput.select();
        }, 500);
    }
}

function setupProjectCardClickHandlers() {
    const projectCards = document.querySelectorAll('.clickable-project');
    
    projectCards.forEach(card => {
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        
        newCard.addEventListener('click', function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
                return;
            }
            
            const projectId = this.dataset.projectId;
            const projectName = this.dataset.projectName;
            
            if (projectId) {
                selectProjectForDonation(projectId, projectName);
            }
        });
    });
}

async function loadLeaderboard() {
    try {
        const response = await fetch(`${API_URL}/leaderboard`);
        const leaderboard = await response.json();
        
        const leaderboardList = document.getElementById('leaderboardList');
        
        if (leaderboard.length === 0) {
            leaderboardList.innerHTML = '<div class="no-donors">Пока нет доноров</div>';
            return;
        }
        
        leaderboardList.innerHTML = `
            <table class="leaderboard-table-content">
                <thead>
                    <tr>
                        <th>Место</th>
                        <th>Имя</th>
                        <th>Сумма пожертвований</th>
                        <th>Количество</th>
                    </tr>
                </thead>
                <tbody>
                    ${leaderboard.map((donor, index) => {
                        const amount = parseFloat(donor.total_amount);
                        let amountDisplay = amount.toFixed(4);
                        if (amount < 0.001) amountDisplay = amount.toFixed(6);
                        
                        return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${donor.first_name || ''} ${donor.last_name || ''} ${donor.first_name ? '' : donor.address.substring(0, 10) + '...'}</td>
                            <td>${amountDisplay} ETH</td>
                            <td>${donor.donation_count}</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Ошибка загрузки лидерборда:', error);
        document.getElementById('leaderboardList').innerHTML = '<div class="error">Ошибка загрузки лидерборда</div>';
    }
}

async function showContractInfo() {
    try {
        const contractInfoDiv = document.getElementById('contractInfo');
        if (!contractInfoDiv || !contractAddress) return;
        
        if (!web3) {
            if (typeof window.ethereum !== 'undefined') {
                web3 = new Web3(window.ethereum);
            } else {
                web3 = new Web3('http://127.0.0.1:8545');
            }
        }
        
        if (!contract && contractAddress && contractABI.length > 0 && web3) {
            contract = new web3.eth.Contract(contractABI, contractAddress);
        }
        
        if (contract && web3) {
            const balance = await web3.eth.getBalance(contractAddress);
            const balanceEth = web3.utils.fromWei(balance, 'ether');
            const donationCount = await contract.methods.donationCount().call();
            const projectCount = await contract.methods.projectCount().call();
            const owner = await contract.methods.owner().call();
            
            contractInfoDiv.innerHTML = `
                <div class="contract-details">
                    <div class="contract-detail-item">
                        <strong>Адрес контракта:</strong>
                        <span class="contract-address" onclick="navigator.clipboard.writeText('${contractAddress}'); alert('Адрес скопирован!');">${contractAddress}</span>
                    </div>
                    <div class="contract-detail-item">
                        <strong>Баланс контракта:</strong>
                        <span class="contract-balance">${parseFloat(balanceEth).toFixed(6)} ETH</span>
                    </div>
                    <div class="contract-detail-item">
                        <strong>Всего пожертвований:</strong>
                        <span>${donationCount}</span>
                    </div>
                    <div class="contract-detail-item">
                        <strong>Всего проектов:</strong>
                        <span>${projectCount}</span>
                    </div>
                    <div class="contract-detail-item">
                        <strong>Владелец контракта:</strong>
                        <span class="contract-owner">${owner.substring(0, 6)}...${owner.substring(38)}</span>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Ошибка загрузки информации о контракте:', error);
        const contractInfoDiv = document.getElementById('contractInfo');
        if (contractInfoDiv) {
            contractInfoDiv.innerHTML = '<div class="error">Ошибка загрузки информации о контракте</div>';
        }
    }
}

async function loadDonationsHistory() {
    try {
        const limit = document.getElementById('donationsLimit')?.value || 50;
        const response = await fetch(`${API_URL}/donations?limit=${limit}`);
        const donations = await response.json();
        
        const donationsHistoryList = document.getElementById('donationsHistoryList');
        
        if (!donations || donations.length === 0) {
            donationsHistoryList.innerHTML = '<div class="no-donors">Пока нет пожертвований</div>';
            return;
        }
        
        donationsHistoryList.innerHTML = `
            <table class="leaderboard-table-content donations-table">
                <thead>
                    <tr>
                        <th>Дата и время</th>
                        <th>Донор</th>
                        <th>Проект</th>
                        <th>Сумма</th>
                        <th>Транзакция</th>
                    </tr>
                </thead>
                <tbody>
                    ${donations.map((donation) => {
                        const date = new Date(donation.timestamp);
                        const formattedDate = date.toLocaleString('ru-RU');
                        
                        let donorName = 'Анонимный донор';
                        if (!donation.is_anonymous) {
                            if (donation.first_name || donation.last_name) {
                                donorName = `${donation.first_name || ''} ${donation.last_name || ''}`.trim();
                            } else {
                                donorName = `${donation.donor_address.substring(0, 6)}...${donation.donor_address.substring(38)}`;
                            }
                        }
                        
                        const amount = parseFloat(donation.amount);
                        let amountDisplay = amount.toFixed(6);
                        if (amount >= 1) amountDisplay = amount.toFixed(4);
                        
                        return `
                            <tr>
                                <td>${formattedDate}</td>
                                <td>${donorName}</td>
                                <td>${donation.project_name || 'Проект #' + donation.project_id}</td>
                                <td class="amount-cell">${amountDisplay} ETH</td>
                                <td class="transaction-cell">
                                    ${donation.transaction_hash ? 
                                        `<span class="transaction-hash-link" onclick="navigator.clipboard.writeText('${donation.transaction_hash}'); alert('Хэш скопирован');">${donation.transaction_hash.substring(0, 10)}...${donation.transaction_hash.substring(56)}</span>` : 
                                        '<span style="color: #999;">Ожидание...</span>'
                                    }
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Ошибка загрузки истории донатов:', error);
        document.getElementById('donationsHistoryList').innerHTML = '<div class="error">Ошибка загрузки истории донатов</div>';
    }
}

function setupEventHandlers() {
    document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
    
    const manualBtn = document.getElementById('manualWalletBtn');
    if (manualBtn) {
        manualBtn.addEventListener('click', showManualWalletInput);
    }
    
    const saveManualBtn = document.getElementById('saveManualAddress');
    if (saveManualBtn) {
        saveManualBtn.addEventListener('click', saveManualAddress);
    }
    
    document.getElementById('donateForm').addEventListener('submit', handleDonation);
    
    const refreshDonationsBtn = document.getElementById('refreshDonationsBtn');
    if (refreshDonationsBtn) {
        refreshDonationsBtn.addEventListener('click', loadDonationsHistory);
    }
    
    const donationsLimit = document.getElementById('donationsLimit');
    if (donationsLimit) {
        donationsLimit.addEventListener('change', loadDonationsHistory);
    }
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#') && !href.includes('http')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
    
    const modal = document.getElementById('successModal');
    if (modal) {
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

async function handleDonation(e) {
    e.preventDefault();
    
    if (!currentAccount) {
        alert('Пожалуйста, подключите кошелек или введите адрес вручную');
        showManualWalletInput();
        return;
    }
    
    const needsProvider = window.ethereum || window.web3?.currentProvider;
    if (!needsProvider && currentAccount) {
        alert('Для отправки транзакций необходим подключенный кошелек (MetaMask и т.д.)');
        return;
    }
    
    const projectId = parseInt(document.getElementById('projectSelect').value);
    const amount = document.getElementById('amount').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const isAnonymous = document.getElementById('isAnonymous').checked;
    
    if (!projectId) {
        alert('Пожалуйста, выберите проект');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        alert('Пожалуйста, укажите сумму пожертвования');
        return;
    }
    
    const donateBtn = document.getElementById('donateBtn');
    donateBtn.disabled = true;
    donateBtn.textContent = 'Обработка...';
    
    try {
        const amountWei = web3.utils.toWei(amount, 'ether');
        
        if (!contract || !contractAddress) {
            alert('Контракт не загружен. Убедитесь, что контракт развернут.');
            return;
        }
        
        const tx = await contract.methods.donate(projectId, isAnonymous).send({
            from: currentAccount,
            value: amountWei,
            gas: 300000
        });
        
        if (firstName || lastName) {
            await fetch(`${API_URL}/donors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: currentAccount,
                    firstName: firstName,
                    lastName: lastName,
                    isAnonymous: isAnonymous
                })
            });
        }
        
        await fetch(`${API_URL}/donations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                donorAddress: currentAccount,
                projectId: projectId,
                amount: amount,
                transactionHash: tx.transactionHash,
                timestamp: Math.floor(Date.now() / 1000),
                isAnonymous: isAnonymous
            })
        });
        
        document.getElementById('successMessage').textContent = 
            `Ваше пожертвование в размере ${amount} ETH успешно отправлено!`;
        document.getElementById('transactionHash').innerHTML = 
            `<strong>Хеш транзакции:</strong> <code>${tx.transactionHash}</code>`;
        document.getElementById('successModal').style.display = 'block';
        
        await loadProjects();
        await loadLeaderboard();
        await loadDonationsHistory();
        await showContractInfo();
        
        document.getElementById('donateForm').reset();
        
    } catch (error) {
        console.error('Ошибка при пожертвовании:', error);
        alert('Ошибка: ' + error.message);
    } finally {
        donateBtn.disabled = false;
        donateBtn.textContent = 'Сделать пожертвование';
    }
}
