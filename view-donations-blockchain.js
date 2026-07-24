/**
 * Скрипт для просмотра транзакций из блокчейна (смарт-контракт)
 * Использование: truffle exec view-donations-blockchain.js --network development
 */

const DonationContract = artifacts.require("DonationContract");

module.exports = async function (callback) {
  try {
    const contract = await DonationContract.deployed();
    console.log('✅ Контракт найден:', contract.address);
    console.log('\n📊 История пожертвований из блокчейна:\n');
    console.log('═'.repeat(120));

    const donationCount = await contract.donationCount();
    const count = parseInt(donationCount.toString());

    if (count === 0) {
      console.log('   Пока нет пожертвований в контракте\n');
      callback();
      return;
    }

    // Получаем последние 100 пожертвований
    const limit = Math.min(count, 100);
    const startIndex = Math.max(1, count - limit + 1);

    for (let i = count; i >= startIndex; i--) {
      try {
        const donation = await contract.getDonation(i);
        const project = await contract.getProject(donation.projectId);

        const date = new Date(parseInt(donation.timestamp.toString()) * 1000);
        const formattedDate = date.toLocaleString('ru-RU');
        
        const amountEth = web3.utils.fromWei(donation.amount.toString(), 'ether');

        console.log(`\n${count - i + 1}. Пожертвование #${i}`);
        console.log(`   📅 Дата: ${formattedDate}`);
        console.log(`   👤 Донор: ${donation.donor}`);
        console.log(`   💰 Сумма: ${parseFloat(amountEth).toFixed(6)} ETH`);
        console.log(`   📋 Проект: ${project.name} (ID: ${donation.projectId})`);
        console.log(`   🔒 Анонимное: ${donation.isAnonymous ? 'Да' : 'Нет'}`);
        console.log('   ' + '─'.repeat(116));
      } catch (error) {
        console.error(`   ❌ Ошибка получения пожертвования #${i}:`, error.message);
      }
    }

    // Статистика по проектам
    const projectCount = await contract.projectCount();
    console.log(`\n📈 Всего пожертвований в контракте: ${count}`);
    console.log(`📋 Всего проектов: ${projectCount.toString()}\n`);

    // Показываем статистику по каждому проекту
    console.log('📊 Статистика по проектам:');
    for (let i = 1; i <= parseInt(projectCount.toString()); i++) {
      try {
        const project = await contract.getProject(i);
        const collectedEth = web3.utils.fromWei(project.collectedAmount.toString(), 'ether');
        const targetEth = web3.utils.fromWei(project.targetAmount.toString(), 'ether');
        const progress = await contract.getProjectProgress(i);
        
        console.log(`\n   Проект #${i}: ${project.name}`);
        console.log(`      Собрано: ${parseFloat(collectedEth).toFixed(6)} ETH`);
        console.log(`      Цель: ${parseFloat(targetEth).toFixed(6)} ETH`);
        console.log(`      Прогресс: ${progress.toString()}%`);
        console.log(`      Статус: ${project.isActive ? '✅ Активен' : '❌ Неактивен'}`);
      } catch (error) {
        console.error(`   ❌ Ошибка получения проекта #${i}:`, error.message);
      }
    }

    console.log('\n');
    callback();
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    callback(error);
  }
};

