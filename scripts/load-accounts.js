const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function loadAccountsFromCSV() {
  const csvFile = path.join(__dirname, '../data/accounts.csv');
  
  if (!fs.existsSync(csvFile)) {
    console.log('❌ Файл accounts.csv не найден!');
    console.log('📝 Создайте файл data/accounts.csv с данными:');
    console.log('twitter_handle,telegram_handle,wallet_address');
    console.log('@user1,@user1_telegram,0x1234...');
    return [];
  }
  
  const accounts = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => {
        accounts.push({
          id: `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `Аккаунт ${accounts.length + 1}`,
          twitterHandle: row.twitter_handle,
          telegramHandle: row.telegram_handle,
          walletAddress: row.wallet_address,
          createdAt: new Date().toISOString()
        });
      })
      .on('end', () => {
        console.log(`✅ Загружено ${accounts.length} аккаунтов из CSV`);
        resolve(accounts);
      })
      .on('error', reject);
  });
}

module.exports = { loadAccountsFromCSV };
