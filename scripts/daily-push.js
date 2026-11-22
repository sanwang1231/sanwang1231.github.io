const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '../data/materials.json');
const PENDING = path.join(__dirname, '../data/pending.json');

const list = JSON.parse(fs.readFileSync(DATA, 'utf8'));

// 北京时间今天
const today = new Date(Date.now() + 8 * 3600 * 1000)
  .toISOString().slice(0, 10);

// 今天已发布过就跳过
if (list.some(i => i.date === today)) {
  console.log('今天已发布过，跳过');
  process.exit(0);
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
