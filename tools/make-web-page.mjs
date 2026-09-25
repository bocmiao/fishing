#!/usr/bin/env node
/**
 * 把 vite build --mode artifact 的输出（dist-web/index.html）改写成网页版发布用的 page.html：
 * 发布平台会自己包上 <html><head><body>，所以这里只保留标题、样式表、脚本和页面内容。
 * 同时打印要一起发布的文件清单。
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dir = 'dist-web';
const html = readFileSync(join(dir, 'index.html'), 'utf8');

const title = html.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>半亩方塘</title>';
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';
// head 里除了 meta 和 title 以外的东西（样式表、预加载、脚本）
const headTags = head
  .replace(/<meta[^>]*>/g, '')
  .replace(/<title>[\s\S]*?<\/title>/, '')
  .trim();

const page = `${title}
<style>
  html, body { height: 100%; margin: 0; overflow: hidden; background: #1c3a3a; }
</style>
${headTags}
${body.trim()}
`;
writeFileSync(join(dir, 'page.html'), page);

const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!['index.html', 'page.html'].includes(name)) files.push(relative(dir, p));
  }
};
walk(dir);
const total = files.reduce((s, f) => s + statSync(join(dir, f)).size, 0);
console.log(`page.html + ${files.length} files, ${(total / 1024 / 1024).toFixed(1)} MB`);
writeFileSync(join(dir, 'files.json'), JSON.stringify(files, null, 2));
