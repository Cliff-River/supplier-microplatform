---
name: hero-ui-v3
description: 本项目的 HeroUI v3 与 Tailwind 4 用法约定：认证表单使用 @heroui/react 的复合组件，业务页面使用 components/ui/form.ts 的类名常量；包含主题、间距、状态标签与响应式规范。修改前端样式或新增组件时使用。
---

# HeroUI v3 与样式约定

## 现状

- `app/globals.css` 引入 `@import "@heroui/styles";` 与 Tailwind 4。
- `@heroui/react` 仅在认证表单中使用（`components/auth/*`），导入 `Button`、`Input`。
- 内部端与供应商端业务页面统一使用 `components/ui/form.ts` 导出的 Tailwind 类名常量，避免散落重复样式。

## 认证表单模式

```tsx
import { Button, Input } from "@heroui/react";

<Input
  label="用户名或邮箱"
  value={username}
  onValueChange={setUsername}
  isRequired
  autoComplete="username"
/>
<Button type="submit" color="primary" isLoading={pending} className="w-full">
  登录
</Button>
```

- 使用受控写法（`value` + `onValueChange`）。
- 提交按钮用 `isLoading` 防重；错误用表单内文案展示，不只依赖 toast。

## 业务页面模式

```tsx
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  dangerButtonClass,
} from "@/components/ui/form";

<input className={inputClass} />
<label className={labelClass}>名称</label>
<button className={primaryButtonClass}>保存</button>
```

- 新增按钮/输入样式时优先复用上述常量；确需新样式再扩展 `form.ts`。
- 弹窗使用 `components/ui/modal.tsx`（`open/title/onClose/footer/wide`），不要引入第二套 Modal。
- 状态标签使用 `components/ui/status-chip.tsx` 的 `StatusChip` 与 `*Meta` 映射，保持颜色语义一致。

## 视觉规范

- 页面背景 `zinc-50` / `slate-50`，卡片白底、`rounded-2xl`、细边框、轻阴影。
- 主色蓝色（`blue-600`），危险操作红色（`red-600`），中性色 slate/zinc。
- 金额与数量加 `tabular-nums`；日期经 `lib/format.ts`。
- 中文正文使用系统字体栈；不要引入新字体。
- 响应式：375 / 768 / 1440 三档；窄屏表格允许容器内横向滚动，页面主体不横向滚动。

## 常见问题

- HeroUI v3 使用复合组件（如 `Card.Header`），不要按 v2 的 props 写法套用。
- 不要在 Server Component 中直接使用需要交互的 HeroUI 组件；用 `"use client"` 拆出客户端组件。
- 避免内联 `style`；统一 Tailwind 工具类。
