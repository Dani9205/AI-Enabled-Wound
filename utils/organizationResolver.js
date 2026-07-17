const Organization = require('../models/organizationModel');

const normalizeOrganizationValue = (value) => String(value || '').trim();

const resolveOrganization = async ({ organizationCode, organizationHospital }) => {
  const code = normalizeOrganizationValue(organizationCode);
  const name = normalizeOrganizationValue(organizationHospital);

  if (code) {
    const organizationByCode = await Organization.findOne({
      where: {
        code,
        status: 'active',
      },
    });

    if (organizationByCode) {
      return organizationByCode;
    }
  }

  if (!name) {
    return null;
  }

  return Organization.findOne({
    where: {
      name,
      status: 'active',
    },
  });
};

module.exports = { resolveOrganization };
