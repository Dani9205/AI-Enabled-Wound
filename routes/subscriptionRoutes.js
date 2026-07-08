const express = require('express');
const {
  cancelSubscription,
  createCheckoutSession,
  getCurrentSubscription,
  getManageSubscription,
  getPlanDetail,
  getPlans,
  restoreApplePurchases,
  subscribe,
  updateUsage,
  verifyAppleSubscription,
} = require('../controllers/subscriptionController');

const router = express.Router();

router.get('/plans', getPlans);
router.get('/plans/:planCode', getPlanDetail);
router.post('/checkout-session', createCheckoutSession);
router.post('/subscribe', subscribe);
router.post('/apple/verify', verifyAppleSubscription);
router.post('/apple/restore', restoreApplePurchases);
router.get('/current/:userId', getCurrentSubscription);
router.get('/manage/:userId', getManageSubscription);
router.patch('/usage/:userId', updateUsage);
router.patch('/cancel/:userId', cancelSubscription);

module.exports = router;
