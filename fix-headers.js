const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/V-Team/Modern_Orthodontics/frontend/src';

function walk(d) {
  let res = [];
  fs.readdirSync(d).forEach(f => {
    const p = path.join(d, f);
    if(fs.statSync(p).isDirectory()) res = res.concat(walk(p));
    else if(p.endsWith('.tsx') || p.endsWith('.ts')) res.push(p);
  });
  return res;
}

const files = walk(dir);
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  // First, replace the object when it only contains headers
  const regex1 = /,\s*\{\s*headers:\s*\{\s*["']Content-Type["']:\s*["']multipart\/form-data["']\s*\}\s*\}/g;
  let newContent = content.replace(regex1, '');
  
  // Second, remove just the headers part if there are other properties like timeout
  const regex2 = /\bheaders:\s*\{\s*["']Content-Type["']:\s*["']multipart\/form-data["']\s*\}\s*,?/g;
  if(newContent.match(regex2)) {
    newContent = newContent.replace(regex2, '');
    // Clean up empty object if left behind: , { }
    newContent = newContent.replace(/,\s*\{\s*\}/g, '');
  }

  if(content !== newContent) {
    fs.writeFileSync(f, newContent);
    console.log('Fixed', f);
  }
});
