# 在线版：GitHub 免费部署研究

核查日期：2026-10-21。单机版与离线打包暂时暂停；`npm run build` 现在只构建网站，不更新旧离线成品。

## 结论

可以免费部署到 GitHub Pages。使用 GitHub Free 的公开仓库，提供免费的 `github.io` 地址和 HTTPS，不需要购买域名。现有 React / TypeScript / Vite 应用可直接作为静态网站部署，脚本、CSS 和照片全部同站存放；评分仍保存在各访问者的浏览器中。

官方资料：[GitHub Pages 简介](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)。

## 免费额度适合当前规模

官方目前规定已发布网站不超过 1 GB、每月流量软限制 100 GB；自定义 GitHub Actions 工作流不受每小时 10 次 Pages 构建软限制约束。当前网站远小于 1 GB。私人朋友使用的静态评分工具在容量上足够，但不能据此承诺任意访问量永远免费。

来源：[Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。不适合把 Pages 当作商业 SaaS 或交易网站托管。

## 国内访问怎么判断

GitHub Pages 的免费额度不等于中国大陆各运营商的访问保证。本项目尚未上线，也没有完成电信、联通、移动实网检查，不能承诺国内始终顺畅。自定义域名本身也不等于大陆加速。

建议先用 GitHub Pages 做零成本试运行，照片放在同一网站，避免浏览器还要访问 HLTV 或 GitHub Raw。部署后用朋友的真实国内网络检查首屏、翻图和图片加载。如果明显不稳，GitHub 保留源码，再把同一套构建输出部署到 EdgeOne Pages 等提供大陆节点的平台。大陆节点与域名备案条件见《国内免费部署》。

## 本工程已准备的配置

仓库根目录有 `.github/workflows/pages.yml`：

1. `main` 分支更新 `cs/` 时触发；也可手动触发。
2. Node.js 22，`npm ci`、数据检查、单元测试。
3. `npm run build:web`，只生成网站 `cs/dist`。
4. 官方 Pages artifact / deploy actions 上传并发布。

官方流程参考：[自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。Vite 相对资源路径和 Service Worker 均按仓库子路径运行，测试使用 `/frame-cs/` 模拟 `/<仓库名>/`。

## 正式上线需要的操作

1. 在自己的 GitHub 账号下创建一个用于该项目的公开仓库；不要上传到无关仓库，也不要把原有私有仓库改成公开。
2. 上传仓库根目录的 `.github/` 与 `cs/`。保留 `cs/public/photos/`、正式 JSON 数据和源码；排除 node_modules、research 原始下载/参考截图、旧 delivery 和 offline-dist。
3. 仓库 Settings → Pages → Source 选择 GitHub Actions。
4. 推送 `main` 或手动运行工作流，等待部署成功。
5. 访问 `https://<用户名>.github.io/<仓库名>/`。例如 `cs-frame` 只是可选仓库名示例，当前未创建。

2026-10-22 用户已确认新建公开仓库 Xocks/cs-frame 并发布，仓库已创建。Pages 最终上线状态以部署验证记录为准。

## 在线功能边界

GitHub Pages 只提供静态托管，不能单独承担公共评分数据库。朋友们可以在线打开网站，各自评分、导出 JSON/CSV；当前没有实时公共总榜。若以后需要统一收集所有人的分数，需要增加 API、数据库和适当的匿名标识/写入控制，另外评估国内网络可用性。

HLTV 照片按项目所有者确认使用权限的声明继续处理，来源、身份映射、原始链接及版权状态逐图保留，未写成“官方已授权”。没有将暂缺的拍摄时间猜成当前年份。
