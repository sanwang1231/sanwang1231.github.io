const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const PENDING = path.join(__dirname, '../data/pending.json');
const SEEN = path.join(__dirname, '../data/seen.json');

// 关键词过滤：标题或摘要里包含任意一个才保留
const KEYWORDS = [
  '习近平', '李强', '赵乐际', '王沪宁', '蔡奇', '丁薛祥', '李希',
  '讲话', '中央政治局', '政治局会议', '国务院常务会议',
  '考察', '会见', '调研', '出席', '发表重要讲话',
  '中央', '国务院', '全国人大', '政协'
];

// 订阅源：想加就往里塞，格式是 [名称, URL]
const FEEDS = [
  ['人民网时政', 'http://www.people.com.cn/rss/politics.xml'],
  ['新华网国内', 'http://rss.xinhuanet.com/rss/native.xml'],
  ['凤凰网大陆', 'http://news.ifeng.com/pubres/rss/mainland/feed.xml']
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      timeout: 15000
    }, res => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetch(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
  });
}

function clean(str) {
  return str
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRSS(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  blocks.forEach(b => {
    const get = tag => {
      const m = b.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
      return m ? clean(m[1]) : '';
    };
    const linkM = b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) 

      || b.match(/<link[^>]*href="([^"]+)"/i);
    items.push({
      title: get('title'),
      link: linkM ? clean(linkM[1]) : '',
      desc: get('description') || get('summary'),
      pubDate: get('pubDate')
    });
  });
  return items;
}

(async () => {
  const seen = fs.existsSync(SEEN) 
    ? JSON.parse(fs.readFileSync(SEEN, 'utf8')) 
    : [];
  const pending = fs.existsSync(PENDING)
    ? JSON.parse(fs.readFileSync(PENDING, 'utf8'))
    : [];

  const seenSet = new Set(seen);
  let added = 0;

  for (const [name, url] of FEEDS) {
    try {
      const xml = await fetch(url);
      const items = parseRSS(xml);
      console.log(`[${name}] 读到 ${items.length} 条`);

      for (const item of items) {
        if (!item.title || !item.link) continue;
        if (seenSet.has(item.link)) continue;

        const text = item.title + ' ' + item.desc;
        if (!KEYWORDS.some(k => text.includes(k))) continue;

        seenSet.add(item.link);
        seen.push(item.link);

        pending.unshift({
          title: item.title,
          category: '时政要闻',
          summary: item.desc.slice(0, 150) || '点击链接查看全文',
          tags: ['自动抓取', name],
          link: item.link,
          sourceDate: item.pubDate
        });
        added++;
        console.log('  +', item.title);
      }
    } catch (e) {
      console.log(`[${name}] 抓取失败：${e.message}`);
    }
  }

  // 池子最多留 60 条，已读记录最多留 2000 条
  fs.writeFileSync(PENDING, JSON.stringify(pending.slice(0, 60), null, 2));
  fs.writeFileSync(SEEN, JSON.stringify(seen.slice(-2000), null, 2));

  console.log(`\n本次新增 ${added} 条，池子现有 ${Math.min(pending.length, 60)} 条`);
})();
