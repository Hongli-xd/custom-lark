/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Feishu card templates for the feishu-bot-creator skill.
 */

type FeishuCardElement = Record<string, unknown>;
type FeishuCard = {
  config?: Record<string, unknown>;
  header?: Record<string, unknown>;
  elements: FeishuCardElement[];
};

/**
 * Build the initial "扫码创建私人机器人" card
 */
export function buildQRCodeCard(qrCodeUrl: string, verificationUrl: string, expireMinutes = 10): FeishuCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🤖 创建私人机器人' },
      template: 'blue',
    },
    elements: [
      {
        tag: 'markdown',
        content: '**请使用飞书扫码授权创建您的私人机器人**\n\n授权完成后，您的私人机器人将自动配置并启动。',
      },
      { tag: 'hr' },
      {
        tag: 'img',
        img_key: qrCodeUrl.startsWith('https://')
          ? `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="100" y="100" text-anchor="middle" font-size="12">QR Code</text></svg>`)}`
          : qrCodeUrl,
        alt: { tag: 'plain_text', content: '二维码' },
      },
      {
        tag: 'markdown',
        content: `**扫码方式：**\n1. 打开飞书 App\n2. 扫描上方二维码\n3. 在授权页面确认创建机器人\n\n📋 **或点击下方链接：**\n\`${verificationUrl}\``,
      },
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [{ tag: 'plain_text', content: `⏱️ 二维码有效期 ${expireMinutes} 分钟，请在有效期内完成授权` }],
      },
      {
        tag: 'div',
        elements: [
          {
            tag: 'markdown',
            content: '**⏳ 等待授权中...**\n\n请在飞书中完成扫码授权，我将自动为您创建私人机器人。',
          },
        ],
      },
    ],
  };
}

/**
 * Build a status update card (for polling progress)
 */
export function buildStatusCard(status: string): FeishuCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🤖 创建私人机器人' },
      template: 'blue',
    },
    elements: [
      { tag: 'markdown', content: '**📋 当前状态：**' },
      { tag: 'div', elements: [{ tag: 'markdown', content: status }] },
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [{ tag: 'plain_text', content: '⏳ 等待扫码授权完成，请稍候...' }],
      },
    ],
  };
}

/**
 * Build the success card shown when bot creation completes
 */
export function buildSuccessCard(
  appId: string,
  domain: 'feishu' | 'lark',
  ownerOpenId: string
): FeishuCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '✅ 私人机器人创建成功' },
      template: 'green',
    },
    elements: [
      { tag: 'markdown', content: '**🎉 恭喜！您的私人机器人已就绪！**' },
      { tag: 'hr' },
      {
        tag: 'div',
        elements: [
          {
            tag: 'markdown',
            content: `**机器人信息：**\n- App ID: \`${appId}\`\n- 区域: ${domain === 'lark' ? '🌐 Lark 国际版' : '🏠 飞书国内版'}\n- 所有者: \`${ownerOpenId}\``,
          },
        ],
      },
      { tag: 'hr' },
      {
        tag: 'markdown',
        content: '**📌 下一步：**\n\n您的私人机器人已自动配置完成。您现在可以直接和机器人对话，它只响应您一个人的消息。\n\n**功能说明：**\n- 📝 消息收发 — 私聊和群聊\n- 📅 日程管理 — 创建和管理日程\n- ✅ 任务管理 — 创建和跟踪任务\n- 📁 云文档 — 读写飞书云文档\n- 🔔 更多功能持续更新中...',
      },
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [{ tag: 'plain_text', content: '🔒 此机器人仅您本人可用，已启用私密模式' }],
      },
    ],
  };
}

/**
 * Build an error card when creation fails
 */
export function buildErrorCard(errorMessage: string): FeishuCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '❌ 创建失败' },
      template: 'red',
    },
    elements: [
      { tag: 'markdown', content: '**😔 抱歉，私人机器人创建失败**' },
      { tag: 'hr' },
      {
        tag: 'div',
        elements: [{ tag: 'markdown', content: `**错误原因：**\n${errorMessage}` }],
      },
      { tag: 'hr' },
      {
        tag: 'markdown',
        content: '**💡 请尝试：**\n1. 重新发送「创建私人机器人」\n2. 检查网络连接\n3. 确保飞书 App 为最新版本\n\n如问题持续，请联系管理员。',
      },
    ],
  };
}

/**
 * Build an intro card shown when user first triggers the skill
 */
export function buildIntroCard(): FeishuCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🤖 创建私人机器人' },
      template: 'blue',
    },
    elements: [
      {
        tag: 'markdown',
        content: '**即将为您创建一个专属的私人飞书机器人**\n\n本机器人将：\n- 🔒 **完全私有** — 仅您本人可以使用\n- 🎯 **专属服务** — 基于您的需求定制\n- 🛡️ **数据隔离** — 您的对话和数据完全私密\n- 🚀 **即开即用** — 创建后立即可用',
      },
      { tag: 'hr' },
      {
        tag: 'markdown',
        content: '**机器人能力：**\n- 📝 智能对话与问答\n- 📅 日程管理（创建、查询、修改日程）\n- ✅ 任务管理（创建任务、设置提醒）\n- 📁 云文档访问\n- 🔍 搜索服务\n- 以及更多...',
      },
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [{ tag: 'plain_text', content: '✅ 点击下方「授权创建」按钮开始创建流程' }],
      },
    ],
  };
}