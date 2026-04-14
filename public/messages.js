/**
 * 扫码挪车 - 推送文案模板
 * 所有文案原则：文明礼貌 + 清晰简洁 + 有效传递紧急程度
 */

const MESSAGE_TEMPLATES = {
  /**
   * 场景 1：小区 🏠
   */
  小区: {
    title: '🏠 有人需要您挪车',
    body: '您好，您的爱车在小区内挡住了通道，麻烦尽快移车，感谢配合！',
    urgency: 'moderate',
  },

  /**
   * 场景 2：商场 🛒
   */
  商场: {
    title: '🛒 有人需要您挪车',
    body: '您好，您的车在商场停车场挡住了其他车辆，麻烦尽快移车，谢谢！',
    urgency: 'moderate',
  },

  /**
   * 场景 3：路边 🅿️
   */
  路边: {
    title: '🅿️ 有人需要您挪车',
    body: '您好，您的爱车挡住了道路，麻烦尽快移车，感谢您的理解与配合！',
    urgency: 'high',
  },

  /**
   * 场景 4：停车场出口 🏎️
   */
  '停车场出口': {
    title: '🏎️ 有人需要您挪车',
    body: '您好，您的车挡住了停车场出口，请尽快移车，谢谢配合！',
    urgency: 'high',
  },

  /**
   * 场景 5：地下车库 🏗️
   */
  '地下车库': {
    title: '🏗️ 有人需要您挪车',
    body: '您好，您的爱车停在地下车库影响了通行，请尽快移车，感谢！',
    urgency: 'moderate',
  },

  /**
   * 场景 6：医院/学校 🏥
   */
  '医院/学校': {
    title: '🏥 有人需要您挪车',
    body: '您好，您的车挡住了医院/学校通道，请尽快移车，谢谢配合！',
    urgency: 'high',
  },

  /**
   * 场景 7：景区 🏖️
   */
  '景区': {
    title: '🏖️ 有人需要您挪车',
    body: '您好，您的车在景区停车场影响了他人，请尽快移车，感谢配合！',
    urgency: 'moderate',
  },

  /**
   * 场景 8：加油站 ⛽
   */
  '加油站': {
    title: '⛽ 有人需要您挪车',
    body: '您好，您的车挡住了加油站通道，请尽快移车，谢谢配合！',
    urgency: 'high',
  },

  /**
   * 场景 9：其他 📍
   */
  '其他': {
    title: '📍 有人需要您挪车',
    body: '您好，您的车需要移一下，麻烦您尽快处理，谢谢！',
    urgency: 'low',
  },
};

/**
 * 根据场景获取完整推送内容
 * @param {string} scene - 场景标识
 * @param {string} extraMsg - 用户填写的额外留言
 * @returns {{ title: string, body: string }}
 */
function getMessage(scene, extraMsg = '') {
  const tpl = MESSAGE_TEMPLATES[scene] || MESSAGE_TEMPLATES['其他'];
  const extra = extraMsg.trim();
  return {
    title: tpl.title,
    body: extra ? `${tpl.body}\n\n📝 附加留言：${extra}` : tpl.body,
    urgency: tpl.urgency,
  };
}

/**
 * Bark 推送选项（供后端使用）
 * 紧急程度与后端 SOUNDS 映射：critical(紧急)/high(重要)/warning(警告)/low(低)
 */
const BARK_OPTIONS = {
  小区:         { urgency: "low",     sound: "default" },
  商场:         { urgency: "low",     sound: "default" },
  路边:         { urgency: "high",    sound: "alarm"   },
  "停车场出口": { urgency: "critical", sound: "alarm"   },
  "地下车库":   { urgency: "low",     sound: "default" },
  "医院/学校":  { urgency: "critical", sound: "alarm"   },
  "景区":       { urgency: "low",     sound: "default" },
  "加油站":     { urgency: "high",    sound: "alarm"   },
  "其他":       { urgency: "low",     sound: "default" },
};

