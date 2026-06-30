const express = require('express');
const {
  cancelSubscription,
  createCheckoutSession,
  getCurrentSubscription,
  getManageSubscription,
  getPlanDetail,
  getPlans,
  subscribe,
  updateUsage,
} = require('../controllers/subscriptionController');

const router = express.Router();

router.get('/plans', getPlans);
router.get('/plans/:planCode', getPlanDetail);
router.post('/checkout-session', createCheckoutSession);
router.post('/subscribe', subscribe);
router.get('/current/:userId', getCurrentSubscription);
router.get('/manage/:userId', getManageSubscription);
router.patch('/usage/:userId', updateUsage);
router.patch('/cancel/:userId', cancelSubscription);

module.exports = router;
