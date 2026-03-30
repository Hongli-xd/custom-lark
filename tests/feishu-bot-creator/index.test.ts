/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { describe, it, expect } from 'vitest';
import {
  isTriggerMessage,
  shouldIntercept,
  type BotCreatorContext,
} from '../../skills/feishu-bot-creator/index';

describe('feishu-bot-creator index', () => {
  describe('isTriggerMessage', () => {
    const testCases: [string, boolean][] = [
      ['创建私人机器人', true],
      ['新建私人机器人', true],
      ['创建我的机器人', true],
      ['create private bot', true],
      ['create personal bot', true],
      ['私人机器人', true],
      ['你好', false],
      ['帮我创建一个bot', false],
      ['创建机器人', false],
      ['hello world', false],
      ['', false],
    ];

    testCases.forEach(([input, expected]) => {
      it(`"${input}" => ${expected}`, () => {
        expect(isTriggerMessage(input)).toBe(expected);
      });
    });
  });

  describe('shouldIntercept', () => {
    it('should delegate to isTriggerMessage', () => {
      expect(shouldIntercept('创建私人机器人')).toBe(true);
      expect(shouldIntercept('hello')).toBe(false);
    });
  });
});

describe('BotCreatorContext interface', () => {
  it('should accept valid context objects', () => {
    const ctx: BotCreatorContext = {
      cfg: { test: true },
      accountId: 'acc_1',
      senderOpenId: 'ou_123',
      chatId: 'oc_456',
      chatType: 'p2p',
      messageId: 'om_789',
    };
    expect(ctx.accountId).toBe('acc_1');
  });

  it('should accept group chat type', () => {
    const ctx: BotCreatorContext = {
      cfg: {},
      accountId: 'acc_1',
      senderOpenId: 'ou_123',
      chatId: 'oc_456',
      chatType: 'group',
    };
    expect(ctx.chatType).toBe('group');
  });
});