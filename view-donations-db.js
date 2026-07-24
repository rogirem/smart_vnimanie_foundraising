/**
 * Скрипт для просмотра транзакций из базы данных MySQL
 * Использование: node view-donations-db.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function viewDonations() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'fondvnimanie',
      charset: 'utf8mb4'
    });

    console.log('✅ Подключение к базе данных установлено\n');
    console.log('📊 История пожертвований из базы данных:\n');
    console.log('═'.repeat(120));

    const [donations] = await connection.execute(`
      SELECT 
        dn.id,
        dn.donor_address,
        dn.project_id,
        dn.amount,
        dn.transaction_hash,
        dn.timestamp,
        dn.is_anonymous,
        dn.created_at,
        d.first_name,
        d.last_name,
        p.name as project_name
      FROM donations dn
      LEFT JOIN donors d ON dn.donor_address = d.address
      LEFT JOIN projects p ON dn.project_id = p.project_id
      ORDER BY dn.timestamp DESC
      LIMIT 100
    `);

    if (donations.length === 0) {
      console.log('   Пока нет пожертвований в базе данных\n');
      return;
    }

    donations.forEach((donation, index) => {
      const date = new Date(donation.timestamp * 1000);
      const formattedDate = date.toLocaleString('ru-RU');
      
      let donorName = 'Анонимный донор';
      if (!donation.is_anonymous) {
        if (donation.first_name || donation.last_name) {
          donorName = `${donation.first_name || ''} ${donation.last_name || ''}`.trim();
        } else {
          donorName = donation.donor_address;
        }
      }

      console.log(`\n${index + 1}. Пожертвование #${donation.id}`);
      console.log(`   📅 Дата: ${formattedDate}`);
      console.log(`   👤 Донор: ${donorName}`);
      console.log(`   💰 Сумма: ${parseFloat(donation.amount).toFixed(6)} ETH`);
      console.log(`   📋 Проект: ${donation.project_name || `Проект #${donation.project_id}`}`);
      if (donation.transaction_hash) {
        console.log(`   🔗 Хеш транзакции: ${donation.transaction_hash}`);
      } else {
        console.log(`   ⚠️  Хеш транзакции: не указан`);
      }
      console.log(`   📍 Адрес донора: ${donation.donor_address}`);
      console.log(`   🔒 Анонимное: ${donation.is_anonymous ? 'Да' : 'Нет'}`);
      console.log('   ' + '─'.repeat(116));
    });

    console.log(`\n📈 Всего пожертвований: ${donations.length}\n`);

    // Статистика
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_count,
        SUM(amount) as total_amount,
        COUNT(DISTINCT donor_address) as unique_donors
      FROM donations
    `);

    console.log('📊 Статистика:');
    console.log(`   Всего пожертвований: ${stats[0].total_count}`);
    console.log(`   Общая сумма: ${parseFloat(stats[0].total_amount || 0).toFixed(6)} ETH`);
    console.log(`   Уникальных доноров: ${stats[0].unique_donors}\n`);

    await connection.end();
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

viewDonations();

