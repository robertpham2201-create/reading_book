import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tìm địa chỉ IP mạng nội bộ (WiFi / LAN) để mở trên điện thoại
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();

console.log('\n=============================================================');
console.log('🚀 KHỞI ĐỘNG ỨNG DỤNG ĐỌC SÁCH KINDLE TIẾNG ANH (FULLSTACK)');
console.log('=============================================================');
console.log(`📱 Mở trên điện thoại cùng mạng WiFi: http://${localIp}:5173`);
console.log(`💻 Mở trên máy tính (Local):          http://localhost:5173`);
console.log(`🔌 Backend API Server:                http://localhost:3001`);
console.log('=============================================================\n');

// Chạy backend
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.resolve(__dirname, 'backend'),
  stdio: 'inherit',
  shell: true,
});

// Chạy frontend
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: path.resolve(__dirname, 'frontend'),
  stdio: 'inherit',
  shell: true,
});

const cleanup = () => {
  console.log('\nĐang dừng các server...');
  backend.kill();
  frontend.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
