#!/bin/bash

# 月光生活家记账应用启动脚本
# 设置API密钥并启动服务器

echo "🌙 启动月光生活家记账应用..."

# 检查config.js文件是否存在
if [ ! -f "config.js" ]; then
    echo "❌ 错误: config.js 文件不存在"
    echo "请确保在项目根目录运行此脚本"
    exit 1
fi

# 启动HTTP服务器
echo "🚀 启动服务器在端口 8093..."
echo "📱 在浏览器中访问: http://localhost:8093"
echo ""

# 启动Python HTTP服务器
python -m http.server 8093
