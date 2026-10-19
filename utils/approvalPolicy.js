const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const settingsPath = path.join(__dirname, '../config/approval-settings.json');

const isApprovalRequired = async () => {
  try {
    const setting = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    if (typeof setting.approval_required !== 'boolean') throw new Error('Invalid approval setting');
    return setting.approval_required;
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    throw error;
  }
};

const saveApprovalRequired = async (approvalRequired) => {
  const temporaryPath = `${settingsPath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify({ approval_required: approvalRequired }) + '\n');
    await fs.rename(temporaryPath, settingsPath);
  } finally {
    await fs.unlink(temporaryPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
};

const getSignupApprovalFields = async (status = 'none', user = null) => {
  if (user?.request_status === 'accepted' || !(await isApprovalRequired())) {
    return { request_status: 'accepted', request_accepted: true };
  }
  return { request_status: status };
};

module.exports = { saveApprovalRequired, getSignupApprovalFields };
