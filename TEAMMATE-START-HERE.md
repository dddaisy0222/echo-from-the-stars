# 给 Echo 场景 / 动效同学

先看这一份：

- [`docs/WORLD-MANIFEST-TEAMMATE-GUIDE.md`](docs/WORLD-MANIFEST-TEAMMATE-GUIDE.md)

你主要会碰三个地方：

1. `public/world/`：放 Marble 导出的 `.spz` 与配套低模碰撞 `.glb`
2. `app/world/engine/world-manifest.js`：登记这个 World 的资产与交互坐标
3. `app/world/engine/entry-effects.js`：注册进入该 World 的动效

完成后访问：

```text
/world?world=你的-world-id
```

其余 Echo Prompt、模型接口、记忆和事实门禁已经接好，不需要你迁移或重写。
