const Organization = require('../models/organizationModel');

const normalizeOrganizationValue = (value) => String(value || '').trim();

const resolveOrganization = async ({
  organizationId,
  organizationCode,
  organizationHospital,
}) => {
  const id = Number(organizationId);
  const code = normalizeOrganizationValue(organizationCode);
  const name = normalizeOrganizationValue(organizationHospital);

  if (Number.isInteger(id) && id > 0) {
    const organizationById = await Organization.findOne({
      where: {
        id,
        status: 'active',
      },
    });

    if (organizationById) {
      return organizationById;
    }
  }

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
