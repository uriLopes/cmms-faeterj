const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// Gera um preview HTML com a logo Vanguard para verificar as proporções
const htmlIcon = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #090a0f;
  }
  .app-icon {
    width: 82%;
    height: 82%;
    background: #0f1117;
    border-radius: 22%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 40px rgba(34, 197, 94, 0.12);
    position: relative;
    overflow: hidden;
  }
  .accent-bar {
    position: absolute;
    bottom: 0;
    left: 25%;
    right: 25%;
    height: 3px;
    background: #22c55e;
    border-radius: 2px;
    box-shadow: 0 0 12px #22c55e;
  }
  svg {
    width: 62%;
    height: 62%;
  }
</style>
</head>
<body>
<div class="app-icon">
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Topo facetado (teto prismático) -->
    <path d="M50 14 L84 32 L50 48 L16 32 Z" fill="#FFFFFF"/>
    <!-- Braço esquerdo do prisma com chanfro do V -->
    <path d="M16 36 L44 51 L44 80 L16 66 Z" fill="#FFFFFF"/>
    <!-- Braço direito do prisma com chanfro do V -->
    <path d="M84 36 L56 51 L56 80 L84 66 Z" fill="#FFFFFF"/>
    <!-- V central em corte dinâmico -->
    <path d="M50 88 L34 56 L44 56 L50 68 L56 56 L66 56 Z" fill="#090A0F"/>
  </svg>
  <div class="accent-bar"></div>
</div>
</body>
</html>
`;

const tempHtml = path.join(__dirname, 'temp-vanguard-icon.html');
fs.writeFileSync(tempHtml, htmlIcon, 'utf-8');

const dest192 = 'C:\\Users\\Iuryl\\Documents\\Projetos\\cmms-faeterj\\apps\\operador\\public\\icon-192.png';
const dest512 = 'C:\\Users\\Iuryl\\Documents\\Projetos\\cmms-faeterj\\apps\\operador\\public\\icon-512.png';
const destFavicon = 'C:\\Users\\Iuryl\\Documents\\Projetos\\cmms-faeterj\\apps\\operador\\public\\favicon.png';
const destFrontendFavicon = 'C:\\Users\\Iuryl\\Documents\\Projetos\\cmms-faeterj\\frontend\\public\\favicon.png';

console.log('Gerando icones Vanguard PWA...');
execSync(`"${edgePath}" --headless=new --disable-gpu --window-size=192,192 --screenshot="${dest192}" "file:///${tempHtml.replace(/\\/g, '/')}"`);
execSync(`"${edgePath}" --headless=new --disable-gpu --window-size=512,512 --screenshot="${dest512}" "file:///${tempHtml.replace(/\\/g, '/')}"`);
fs.copyFileSync(dest192, destFavicon);
fs.copyFileSync(dest192, destFrontendFavicon);

fs.unlinkSync(tempHtml);
console.log('Icones Vanguard gerados com sucesso!');
