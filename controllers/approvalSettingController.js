const { saveApprovalRequired } = require('../utils/approvalPolicy');

const updateApprovalSetting = async (req, res) => {
  const value = req.body?.approval_required;
  const approvalRequired = typeof value === 'boolean'
    ? value
    : typeof value === 'string' && ['ON', 'OFF'].includes(value.trim().toUpperCase())
      ? value.trim().toUpperCase() === 'ON'
      : null;

  if (approvalRequired === null) {
    return res.status(400).json({ message: 'approval_required must be true, false, "ON" or "OFF"' });
  }

  try {
    await saveApprovalRequired(approvalRequired);
    return res.status(200).json({
      message: approvalRequired ? 'Manual approval enabled' : 'Automatic approval enabled',
      approval_required: approvalRequired,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Approval setting update failed' });
  }
};

module.exports = { updateApprovalSetting };
