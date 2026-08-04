const fs = require('fs');
const f = 'C:/Users/V-Team/Modern_Orthodontics/frontend/src/app/admin/cms/pages/[id]/page.tsx';
let content = fs.readFileSync(f, 'utf8');
const rx = /,\s*\{\s*headers:\s*\{\s*["']Content-Type["']:\s*["']multipart\/form-data["'],?\s*\}\s*,?\s*\}/g;
content = content.replace(rx, '');
fs.writeFileSync(f, content);
console.log('Fixed [id]/page.tsx');
