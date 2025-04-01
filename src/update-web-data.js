const fs = require('fs');
const path = require('path');

// 定义文件路径
const sourceFile = path.join(process.cwd(), 'version-history.json');
const targetDir = path.join(process.cwd(), 'web', 'public', 'data');
const targetFile = path.join(targetDir, 'version-history.json');

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
  console.log(`Creating directory: ${targetDir}`);
  fs.mkdirSync(targetDir, { recursive: true });
}

// 复制文件
try {
  console.log(`Copying ${sourceFile} to ${targetFile}`);
  fs.copyFileSync(sourceFile, targetFile);
  console.log('File copied successfully.');
} catch (error) {
  console.error('Error copying file:', error.message);
  process.exit(1);
} 