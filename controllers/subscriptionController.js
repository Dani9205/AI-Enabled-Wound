const Subscription = require('../models/subscriptionModel');
const User = require('../models/userModel');

const PLANS = [
  {
    code: 'free',
    name: 'Free',
    audience: 'For Patients & Basic Users',
    currency: 'CHF',
    amount: 0,
    interval: 'forever',
    badge: null,
    trial_days: 0,
    limits: {
      ai_notes: 0,
      patients: 0,
      staff_members: 0,
    },
    features: [
      'Patient registration & login',
      'View personal profile',
      'View assigned wound cases',
      'Track healing progress',
      'View images, reports, and clinical notes',
    ],
    disabled_features: ['No AI / Sharing / Tasks / Reports'],
  },
  {
    code: 'basic',
    name: 'Basic',
    audience: 'For independent clinicians',
    currency: 'CHF',
    amount: 19,
    interval: 'month',
    badge: null,
    trial_days: 0,
    limits: {
      ai_notes: 0,
      patients: 'limited',
      staff_members: 1,
    },
    features: [
      'Create and manage patients',
      'Create wound cases',
      'Add wound updates',
      'Upload wound images',
      'Record wound measurements',
      'Manual clinical notes',
      'Wound timeline management',
      'PDF report generation',
      'AI voice transcription',
    ],
    disabled_features: [],
  },
  {
    code: 'professional',
    name: 'Professional',
    audience: 'For advanced clinical wound care',
    currency: 'CHF',
    amount: 49,
    interval: 'month',
    badge: 'Most Popular',
    trial_days: 7,
    limits: {
      ai_notes: 'unlimited',
      patients: 'unlimited',
      staff_members: 1,
    },
    features: [
      'Everything in Basic',
      'AI clinical note generation (SOAP)',
      'AI-assisted documentation',
      'Task management',
      'Patient sharing & collaboration',
      'External doctor access',
      'Advanced reporting',
      'Priority support',
    ],
    disabled_features: [],
  },
  {
    code: 'organization',
    name: 'Organization',
    audience: 'For clinics, hospitals & care facilities',
    currency: 'CHF',
    amount: 299,
    interval: 'month',
    badge: null,
    trial_days: 0,
    limits: {
      ai_notes: 'unlimited',
      patients: 'unlimited',
      staff_members: 20,
      extra_staff_price: 'CHF 10/user/month',
    },
    features: [
      'Organization admin',
      'Organization code',
      'Staff management',
      'Multiple nurses',
      'Multiple doctors',
      'Care coordinators',
      'Team collaboration',
      'Patient handoff',
      'Role permissions',
      'Organization reports',
      'Centralized billing',
    ],
    disabled_features: [],
  },
];

const cleanString = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed || undefined;
};

const parseId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
};

const asObject = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  return {};
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getPlan = (code) => PLANS.find((plan) => plan.code === code);

const subscriptionResponse = (subscription) => {
  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    user_id: subscription.user_id,
    plan_code: subscription.plan_code,
    plan_name: subscription.plan_name,
    billing_provider: subscription.billing_provider,
    provider_subscription_id: subscription.provider_subscription_id,
    currency: subscription.currency,
    amount: subscription.amount,
    interval: subscription.interval,
    status: subscription.status,
    usage: asObject(subscription.usage),
    features: subscription.features || [],
    trial_ends_at: subscription.trial_ends_at,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    cancelled_at: subscription.cancelled_at,
    metadata: asObject(subscription.metadata),
    created_at: subscription.createdAt,
    updated_at: subscription.updatedAt,
  };
};

const ensureUser = async (userId) => {
  const parsedUserId = parseId(userId);

  if (!parsedUserId || Number.isNaN(parsedUserId)) {
    return { error: 'user_id is required' };
  }

  const user = await User.findByPk(parsedUserId);

  if (!user) {
    return { error: 'User not found' };
  }

  return { user };
};

const getPlans = async (req, res) => {
  return res.status(200).json({ plans: PLANS });
};

const getPlanDetail = async (req, res) => {
  const plan = getPlan(String(req.params.planCode || '').toLowerCase());

  if (!plan) {
    return res.status(404).json({ message: 'Plan not found' });
  }

  return res.status(200).json({ plan });
};

const buildCheckoutPayload = (plan, provider) => ({
  plan,
  provider,
  payment_summary: {
    title: `AI-Enabled Wound ${plan.name}`,
    amount: plan.amount,
    currency: plan.currency,
    interval: plan.interval,
    trial_days: plan.trial_days,
    no_commitment: true,
  },
  apple_pay: {
    supported: provider === 'apple_pay' || provider === 'app_store',
    merchant_label: 'AI-Enabled Wound',
  },
  google_pay: {
    supported: provider === 'google_pay',
    merchant_label: 'AI-Enabled Wound',
  },
});

const createCheckoutSession = async (req, res) => {
  try {
    const planCode = cleanString(req.body.plan_code || req.body.planCode);
    const provider = cleanString(req.body.provider) || 'manual';
    const plan = getPlan(planCode);

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    return res.status(200).json({
      message: 'Checkout session created successfully',
      checkout: buildCheckoutPayload(plan, provider),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Checkout session creation failed',
      error: error.message,
    });
  }
};

const subscribe = async (req, res) => {
  try {
    const { user, error } = await ensureUser(req.body.user_id || req.body.userId);

    if (error) {
      return res.status(error === 'User not found' ? 404 : 400).json({ message: error });
    }

    const planCode = cleanString(req.body.plan_code || req.body.planCode) || 'free';
    const plan = getPlan(planCode);

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    const now = new Date();
    const provider = cleanString(req.body.provider) || 'manual';
    const status = plan.trial_days > 0 && req.body.start_trial !== false ? 'trialing' : 'active';
    const existing = await Subscription.findOne({
      where: {
        user_id: user.id,
        status: ['active', 'trialing'],
      },
      order: [['createdAt', 'DESC']],
    });
    const payload = {
      user_id: user.id,
      plan_code: plan.code,
      plan_name: plan.name,
      billing_provider: provider,
      provider_subscription_id:
        cleanString(req.body.provider_subscription_id || req.body.providerSubscriptionId) ||
        null,
      currency: plan.currency,
      amount: plan.amount,
      interval: plan.interval,
      status,
      usage: {
        ai_notes: 0,
        patients: 0,
      },
      features: plan.features,
      trial_ends_at: status === 'trialing' ? addDays(now, plan.trial_days) : null,
      current_period_start: now,
      current_period_end: plan.interval === 'month' ? addMonths(now, 1) : null,
      cancelled_at: null,
      metadata: {
        source: cleanString(req.body.source) || 'mobile_app',
        original_plan_code: existing ? existing.plan_code : null,
      },
    };
    const subscription = existing
      ? await existing.update(payload)
      : await Subscription.create(payload);

    return res.status(existing ? 200 : 201).json({
      message: existing
        ? 'Subscription updated successfully'
        : 'Subscription created successfully',
      subscription: subscriptionResponse(subscription),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Subscription failed',
      error: error.message,
    });
  }
};

const getCurrentSubscription = async (req, res) => {
  try {
    const { user, error } = await ensureUser(req.params.userId || req.query.user_id);

    if (error) {
      return res.status(error === 'User not found' ? 404 : 400).json({ message: error });
    }

    const subscription = await Subscription.findOne({
      where: { user_id: user.id },
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      subscription: subscriptionResponse(subscription),
      available_plans: PLANS,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Current subscription fetch failed',
      error: error.message,
    });
  }
};

const getManageSubscription = async (req, res) => {
  try {
    const { user, error } = await ensureUser(req.params.userId || req.query.user_id);

    if (error) {
      return res.status(error === 'User not found' ? 404 : 400).json({ message: error });
    }

    const subscription = await Subscription.findOne({
      where: { user_id: user.id },
      order: [['createdAt', 'DESC']],
    });
    const current = subscriptionResponse(subscription);
    const currentPlanCode = current ? current.plan_code : 'free';

    return res.status(200).json({
      current_plan: current,
      usage: current
        ? current.usage
        : {
            ai_notes: 0,
            patients: 0,
          },
      upgrade_options: PLANS.filter((plan) => plan.code !== currentPlanCode),
      can_cancel: Boolean(subscription && ['active', 'trialing'].includes(subscription.status)),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Manage subscription fetch failed',
      error: error.message,
    });
  }
};

const updateUsage = async (req, res) => {
  try {
    const { user, error } = await ensureUser(req.params.userId || req.body.user_id);

    if (error) {
      return res.status(error === 'User not found' ? 404 : 400).json({ message: error });
    }

    const subscription = await Subscription.findOne({
      where: { user_id: user.id },
      order: [['createdAt', 'DESC']],
    });

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    const nextUsage = {
      ...asObject(subscription.usage),
      ...asObject(req.body.usage || req.body),
    };

    await subscription.update({ usage: nextUsage });

    return res.status(200).json({
      message: 'Subscription usage updated successfully',
      subscription: subscriptionResponse(subscription),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Subscription usage update failed',
      error: error.message,
    });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const { user, error } = await ensureUser(req.params.userId || req.body.user_id);

    if (error) {
      return res.status(error === 'User not found' ? 404 : 400).json({ message: error });
    }

    const subscription = await Subscription.findOne({
      where: {
        user_id: user.id,
        status: ['active', 'trialing'],
      },
      order: [['createdAt', 'DESC']],
    });

    if (!subscription) {
      return res.status(404).json({ message: 'Active subscription not found' });
    }

    await subscription.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      metadata: {
        ...asObject(subscription.metadata),
        cancellation_reason: cleanString(req.body.reason) || null,
      },
    });

    return res.status(200).json({
      message: 'Subscription cancelled successfully',
      subscription: subscriptionResponse(subscription),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Subscription cancellation failed',
      error: error.message,
    });
  }
};

module.exports = {
  cancelSubscription,
  createCheckoutSession,
  getCurrentSubscription,
  getManageSubscription,
  getPlanDetail,
  getPlans,
  subscribe,
  updateUsage,
};
