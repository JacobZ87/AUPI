# 澳洲房产投资计算器 (Vercel 可部署)

一个基于 Next.js 的在线计算器，用于快速评估澳洲住宅投资物业：

- 贷款金额、LVR
- NSW / VIC / QLD 印花税估算
- 年租金、运营成本、年度现金流
- 毛/净租金回报率

## 本地运行

```bash
npm install
npm run dev
```

## 推送到 GitHub

> 如果你还没有 GitHub 仓库，请先在 GitHub 上新建一个空仓库（不要勾选初始化 README）。

```bash
git init
git add .
git commit -m "feat: 澳洲房产投资计算器"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<你的仓库名>.git
git push -u origin main
```

如果你的仓库已经有远程地址，只需：

```bash
git add .
git commit -m "chore: update project"
git push
```


## 一键自动推送到 GitHub（不会手动也可以）

我已经在仓库里加了脚本：`scripts/push-to-github.sh`。

### 1) 先在 GitHub 创建空仓库
例如：`https://github.com/<你的用户名>/<仓库名>.git`

### 2) 生成 GitHub Token（只需一次）
- GitHub -> Settings -> Developer settings -> Personal access tokens -> Tokens (classic)
- 勾选 `repo` 权限

### 3) 在本地执行（自动提交 + 自动推送）

```bash
export GITHUB_TOKEN=你的token
./scripts/push-to-github.sh https://github.com/<你的用户名>/<仓库名>.git main
```

脚本会自动完成：
- 检测并提交未提交代码
- 配置 origin
- 推送到 GitHub
- 推送后自动把 remote URL 还原为不带 token 的地址

## 部署到 Vercel

1. 将本仓库推送到 GitHub。
2. 登录 [Vercel](https://vercel.com) 并 `Add New Project`。
3. 选择该 GitHub 仓库并直接部署（默认配置即可）。

构建命令：`npm run build`  
输出由 Next.js 自动处理。

## 说明

- 计算结果为估算值，实际税费与贷款条件请以专业机构为准。
- 当前印花税逻辑覆盖常见区间，适合快速测算。
