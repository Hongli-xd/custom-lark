---
name: feishu-bot-creator
description: |
  引导用户通过 OAuth 设备授权流程创建私人飞书机器人。用户扫码授权后，系统自动完成配置更新和多租户隔离设置。
triggerKeywords:
  - "创建私人机器人"
  - "新建私人机器人"
  - "私人机器人"
  - "create private bot"
  - "create personal bot"
---

# feishu-bot-creator

当用户表达「想要创建自己的私人机器人」时，自动引导用户完成扫码授权，并实现全自动的配置更新与多租户隔离。

## 工作流程

```
用户发送「创建私人机器人」
         │
         ▼
[1/4] 获取管理机器人凭证
       ↓ 读取 openclaw.json 中已有的飞书配置
[2/4] 发起 OAuth 设备授权
       ↓ 飞书开放平台返回 device_code
       ↓ 发送二维码卡片到用户 P2P
       ↓ 后台轮询等待用户授权（最多 10 分钟）
       ↓ 授权成功 → 拿到 app_id, app_secret, user_open_id
[3/4] 写入 openclaw.json
       ↓ channels.feishu.accounts[userOpenId] = { appId, appSecret, ... }
       ↓ 自动启用插件
[4/4] 通知 OpenClaw 重启网关
       ↓ gateway install → gateway restart
       ↓ 发送成功卡片给用户
```

## 多租户隔离设计

每个用户的私人机器人使用用户的 `open_id` 作为 `accountId`，实现「一 Bot 一 Agent」隔离：

| 配置字段 | 值 | 含义 |
|---------|-----|------|
| `accountId` | `userOpenId` | 每个用户独立账户 |
| `dmPolicy` | `allowlist` | 仅创建者能私聊 |
| `allowFrom` | `[userOpenId]` | 私聊白名单 |
| `groupPolicy` | `allowlist` | 仅创建者可邀请机器人 |
| `groupAllowFrom` | `[userOpenId]` | 群组白名单 |
| `connectionMode` | `websocket` | WebSocket 长连接 |
| `uat.enabled` | `true` | 启用用户 OAuth |

## 触发方式

用户在飞书任意对话（私聊或群聊）中发送：

- 中文：`创建私人机器人`、`新建私人机器人`、`私人机器人`
- 英文：`create private bot`、`create personal bot`

## 集成方式

在 `src/channel/event-handlers.ts` 的消息处理入口添加触发检查：

```typescript
import { shouldIntercept, handleBotCreation } from '../../skills/feishu-bot-creator/index.js';

// 在 handleMessageEvent 的 task 回调里，最开始添加拦截：
const rawContent = event.message?.content || '';
if (shouldIntercept(rawContent)) {
  log(`feishu[${accountId}]: bot-creator skill intercepted`);
  try {
    await handleBotCreation({
      cfg: ctx.cfg,
      accountId,
      senderOpenId: event.sender?.sender_id?.open_id || '',
      chatId: event.message?.chat_id || '',
      chatType: (event.message?.chat_type as 'p2p' | 'group') || 'p2p',
      messageId: event.message?.message_id,
    });
  } catch (err) {
    error(`feishu[${accountId}]: bot-creator skill error: ${String(err)}`);
  }
  return; // 不继续分发消息
}
```

## 文件结构

```
skills/feishu-bot-creator/
├── index.ts              # 入口：消息拦截 + 处理函数
├── device-flow.ts        # OAuth 设备授权流程
├── config-writer.ts      # 写入 openclaw.json
├── card-templates.ts     # 飞书卡片模板
├── config.ts             # 环境配置和路径工具
└── SKILL.md              # 本文件
```