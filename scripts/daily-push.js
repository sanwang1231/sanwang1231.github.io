const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '../data/materials.json');
const PENDING = path.join(__dirname, '../data/pending.json');

const list = JSON.parse(fs.readFileSync(DATA, 'utf8'));

// 北京时间今天
// ===== 每 2 小时发一条 =====
const INTERVAL_MS = 2 * 60 * 60 * 1000;

if (news.length > 0) {
    const last = news[news.length - 1];
    const lastTime = last.timestamp
        ? new Date(last.timestamp).getTime()
        : new Date(last.date).getTime();

    const elapsed = Date.now() - lastTime;

    if (elapsed < INTERVAL_MS) {
        const remainMin = Math.ceil((INTERVAL_MS - elapsed) / 60000);
        console.log(`距上次发布仅 ${Math.floor(elapsed / 60000)} 分钟，还需 ${remainMin} 分钟，跳过`);
        return;
    }
}

if (!fs.existsSync(PENDING)) {
  console.log('没有待发布池，跳过');
  process.exit(0);
}

const pending = JSON.parse(fs.readFileSync(PENDING, 'utf8'));

if (pending.length === 0) {
  console.log('待发布池是空的，跳过');
  process.exit(0);
}

// 从池子最前面取一条
const next = pending.shift();
next.date = today;
if (!next.id) next.id = 'm' + Date.now();
list.unshift(next);

fs.writeFileSync(PENDING, JSON.stringify(pending, null, 2));
fs.writeFileSync(DATA, JSON.stringify(list, null, 2));

console.log('已发布：', next.title);
console.log('池子剩余：', pending.length, '条');
