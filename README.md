# Echo｜Possible Worlds

Echo 是一场与平行世界中的自己对话的选择游戏。它把困扰你的现实问题转化为四条人生世界线，让你进入不同选择后的日常，与那里的自己交谈，再把一枚回声碎片带回现实。

## 在线体验

- [GitHub Pages 稳定版](https://dddaisy0222.github.io/echo-from-the-stars/)
- [Echo Sites 版](https://echo-from-the-stars.yuanxin20020222.chatgpt.site/)

## 体验闭环

1. 写下此刻困住自己的问题
2. 在世界线地图中选择一个平行自我
3. 进入她的生活，理解一种选择的得到与代价
4. 通过分支对话取得 Echo 回声碎片
5. 返回此刻，生成属于自己的选择罗盘

## 为什么做 Echo

当 AI 越来越擅长给出答案，我们更想探索另一种关系：AI 不替人做决定，而是将散落的生命碎片重新编织，以“镜像自我”的方式帮助人看见自身的可能性。

## 当前原型

这是为黑客松准备的交互式 MVP。它包含四条可探索的世界线、分支对话、回声碎片收集、共鸣值和最终选择罗盘。当前版本使用本地生成的对话逻辑展示完整产品路径，不收集或上传用户输入。

## 本地运行

```bash
npm install
npm run dev
```

构建 GitHub Pages 静态版本：

```bash
npm run build:pages
```

## 技术栈

- React 19
- Next.js 兼容接口与 Vinext
- TypeScript
- CSS 动画与响应式布局
- Cloudflare Workers / Sites 与 GitHub Pages 双部署

## 团队

赵妍、管航、袁欣、何烨

---

> 未来不是远方，是一颗正在等待你的星。
