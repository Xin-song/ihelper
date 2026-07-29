# 首次同步到 GitHub
# 用法：在 PowerShell 中执行  .\scripts\push-to-github.ps1
#
# 说明：我在沙箱里初始化过一次 git，但沙箱对 OneDrive 挂载目录没有删除权限，
# 残留了几个 .lock 文件导致仓库处于半损坏状态。此脚本会清掉重来 ——
# 目前仓库里只有文档，没有任何历史值得保留。

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> 清理沙箱残留的 .git" -ForegroundColor Cyan
if (Test-Path .git) { Remove-Item -Recurse -Force .git }

Write-Host "==> 初始化仓库" -ForegroundColor Cyan
git init
git branch -M main

# 如果没配过全局身份，取消下面两行的注释并填入你的信息
# git config user.name  "Xin-song"
# git config user.email "zzysdxt@gmail.com"

Write-Host "==> 提交" -ForegroundColor Cyan
git add -A
git commit -m "docs: 初始化项目文档 — 路线图、需求规格、技术架构"

Write-Host "==> 关联远程并推送" -ForegroundColor Cyan
git remote add origin https://github.com/Xin-song/ihelper.git
git push -u origin main

Write-Host "`n完成。访问 https://github.com/Xin-song/ihelper 确认。" -ForegroundColor Green
