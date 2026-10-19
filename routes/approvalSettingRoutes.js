const express = require('express');
const { adminAuthMiddleware } = require('../middleware/authMiddleware');
const { updateApprovalSetting } = require('../controllers/approvalSettingController');

const router = express.Router();
router.put('/', ...adminAuthMiddleware, updateApprovalSetting);

module.exports = router;
