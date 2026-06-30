const http = require('http');
const { spawn } = require('child_process');
const sequelize = require('../config/db');
const Patient = require('../models/patientModel');
const Task = require('../models/taskModel');
const User = require('../models/userModel');
const WoundCase = require('../models/woundCaseModel');
const PatientHandoff = require('../models/patientHandoffModel');
const Notification = require('../models/notificationModel');
const { hashPassword } = require('../utils/security');

const runId = `smoke_${Date.now()}`;
const port = String(4100 + Math.floor(Math.random() * 700));
const baseUrl = `http://127.0.0.1:${port}`;
const results = [];
const created = {
  notificationId: null,
  reportId: null,
  woundCaseId: null,
  woundImageId: null,
  taskId: null,
  patientIds: [],
  handoffId: null,
  userIds: [],
};

const request = (method, path, body) =>
  new Promise((resolve) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      `${baseUrl}${path}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch (error) {
            json = { raw: data };
          }

          resolve({ status: res.statusCode, body: json });
        });
      }
    );

    req.on('error', (error) => resolve({ status: 0, body: { error: error.message } }));

    if (payload) {
      req.write(payload);
    }

    req.end();
  });

const expectStatus = async (label, method, path, expected, body) => {
  const response = await request(method, path, body);
  const expectedList = Array.isArray(expected) ? expected : [expected];
  const ok = expectedList.includes(response.status);

  results.push({
    label,
    method,
    path,
    expected: expectedList.join('/'),
    status: response.status,
    ok,
    message: response.body && response.body.message,
  });

  if (!ok) {
    throw new Error(`${label} returned ${response.status}: ${JSON.stringify(response.body)}`);
  }

  return response.body;
};

const waitForServer = async () => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 60000) {
    const response = await request('GET', '/api/dashboard/stats');

    if (response.status === 200) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error('Server did not become ready');
};

const createUser = async ({ firstName, lastName, email, role }) => {
  const user = await User.create({
    name: `${firstName} ${lastName}`,
    first_name: firstName,
    last_name: lastName,
    email,
    phone_number: '+15550000000',
    role,
    password_hash: hashPassword('Password123!'),
    terms_accepted: true,
    terms_accepted_at: new Date(),
    is_email_verified: true,
    request_accepted: true,
  });

  created.userIds.push(user.id);
  return user;
};

const cleanup = async () => {
  await Notification.destroy({ where: { user_id: created.userIds } });
  await PatientHandoff.destroy({ where: { from_nurse_id: created.userIds } });
  await WoundCase.destroy({ where: { id: created.woundCaseId || 0 } });
  await Task.destroy({ where: { id: created.taskId || 0 } });
  await Patient.destroy({ where: { id: created.patientIds } });
  await User.destroy({ where: { id: created.userIds }, force: true });
};

const main = async () => {
  await sequelize.sync();
  await cleanup();

  const nurse = await createUser({
    firstName: 'Smoke',
    lastName: 'Nurse',
    email: `${runId}_nurse@example.com`,
    role: 'nurse',
  });
  const nurseTwo = await createUser({
    firstName: 'Backup',
    lastName: 'Nurse',
    email: `${runId}_backup@example.com`,
    role: 'nurse',
  });
  const doctor = await createUser({
    firstName: 'Smoke',
    lastName: 'Doctor',
    email: `${runId}_doctor@example.com`,
    role: 'doctor',
  });

  const server = spawn(process.execPath, ['app.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  try {
    await waitForServer();

    await expectStatus('auth create account validation', 'POST', '/api/auth/create-account', 400, {});
    await expectStatus('auth organization validation', 'POST', '/api/auth/create-organization-account', 400, {});
    await expectStatus('auth signin', 'POST', '/api/auth/signin', 200, {
      email: nurse.email,
      password: 'Password123!',
    });
    await expectStatus('auth verify code validation', 'POST', '/api/auth/verify-code', 400, {});
    await expectStatus('auth forgot password validation', 'POST', '/api/auth/forgot-password', 400, {});
    await expectStatus('auth reset password validation', 'POST', '/api/auth/reset-password', 400, {});
    await expectStatus('auth change role', 'PUT', '/api/auth/change-role', 200, {
      email: doctor.email,
      role: 'doctor',
    });
    await expectStatus('auth accept organization request', 'PUT', '/api/auth/accept-organization-request', 200, {
      email: nurse.email,
    });

    const patient = await expectStatus('patient create', 'POST', '/api/patients/create-patient', 201, {
      nurse_id: nurse.id,
      first_name: 'Michael',
      last_name: 'Smoke',
      date_of_birth: '1980-01-01',
      gender: 'male',
      mrn: `${runId}_MRN_1`,
      room: 'Room 204',
      wound_type: 'Diabetic Foot Ulcer',
      primary_diagnosis: 'Diabetic Foot Ulcer',
    });
    created.patientIds.push(patient.patient.id);

    const handoffPatient = await expectStatus('patient create for handoff', 'POST', '/api/patients/create-patient', 201, {
      nurse_id: nurse.id,
      first_name: 'Handoff',
      last_name: 'Smoke',
      gender: 'female',
      mrn: `${runId}_MRN_2`,
      room: 'Room 205',
      wound_type: 'Pressure Ulcer',
    });
    created.patientIds.push(handoffPatient.patient.id);

    await expectStatus('patient list', 'GET', '/api/patients/get-patient', 200);
    await expectStatus('patient detail', 'GET', `/api/patients/get-patient/${patient.patient.id}`, 200);
    await expectStatus('patient update', 'PUT', `/api/patients/update-patient/${patient.patient.id}`, 200, {
      room: 'Room 206',
    });

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
    const task = await expectStatus('task create', 'POST', '/api/tasks/create-task', 201, {
      title: 'Smoke wound dressing change',
      task_type: 'wound',
      priority: 'high',
      status: 'pending',
      patient_id: patient.patient.id,
      assigned_by: doctor.id,
      assigned_to: nurse.id,
      due_date: today,
      due_time: '10:30',
      wound_case: 'Diabetic Foot Ulcer',
    });
    created.taskId = task.task.id;

    await expectStatus('task list', 'GET', '/api/tasks/get-task', 200);
    await expectStatus('task detail', 'GET', `/api/tasks/get-task/${created.taskId}`, 200);
    await expectStatus('task update', 'PUT', `/api/tasks/update-task/${created.taskId}`, 200, {
      priority: 'medium',
    });
    await expectStatus('task reassign', 'PATCH', `/api/tasks/reassign-task/${created.taskId}`, 200, {
      assigned_to: nurse.id,
    });
    await expectStatus('task complete', 'PATCH', `/api/tasks/complete-task/${created.taskId}`, 200, {
      work_notes: 'Completed by smoke test',
    });

    const woundCase = await expectStatus('wound case create', 'POST', '/api/wound-cases/create-wound-case', 201, {
      patient_id: patient.patient.id,
      wound_type: 'Diabetic Foot Ulcer',
      severity_stage: 'Stage III',
      pain_score: 7,
      body_location: 'Left Heel',
      wound_etiology: 'Diabetes',
      length_cm: 3.5,
      width_cm: 2.2,
      depth_cm: 0.5,
      healing_progress: 42,
    });
    created.woundCaseId = woundCase.wound_case.id;

    await expectStatus('wound case list', 'GET', '/api/wound-cases/get-wound-case', 200);
    await expectStatus('wound case detail', 'GET', `/api/wound-cases/get-wound-case/${created.woundCaseId}`, 200);
    await expectStatus('wound case update', 'PUT', `/api/wound-cases/update-wound-case/${created.woundCaseId}`, 200, {
      status: 'monitoring',
    });
    await expectStatus('wound add update', 'PATCH', `/api/wound-cases/add-wound-update/${created.woundCaseId}`, 200, {
      title: 'Smoke update',
      healing_progress: 50,
      measurement: { length_cm: 3.3, width_cm: 2.1, depth_cm: 0.4, pain_score: 6 },
      clinical_note: 'Smoke wound update note',
    });
    const image = await expectStatus('wound add image', 'PATCH', `/api/wound-cases/add-wound-image/${created.woundCaseId}`, 200, {
      url: 'https://example.com/wound-smoke.jpg',
      caption: 'Smoke image',
    });
    created.woundImageId = image.wound_case.images[image.wound_case.images.length - 1].id;
    await expectStatus('wound add measurement', 'PATCH', `/api/wound-cases/add-measurement/${created.woundCaseId}`, 200, {
      length_cm: 3.2,
    });
    await expectStatus('wound get timeline', 'GET', `/api/wound-cases/get-timeline/${created.woundCaseId}`, 200);
    await expectStatus('wound get images', 'GET', `/api/wound-cases/get-images/${created.woundCaseId}`, 200);
    await expectStatus('wound get measurements', 'GET', `/api/wound-cases/get-measurements/${created.woundCaseId}`, 200);
    await expectStatus('wound add note', 'PATCH', `/api/wound-cases/add-note/${created.woundCaseId}`, 200, {
      text: 'Smoke clinical note',
    });
    await expectStatus('wound save voice dictation', 'POST', `/api/wound-cases/save-voice-dictation/${created.woundCaseId}`, 201, {
      transcript: 'Smoke voice transcript',
      duration_seconds: 24,
    });
    await expectStatus('wound generate soap', 'POST', `/api/wound-cases/generate-soap-note/${created.woundCaseId}`, 200, {
      text: 'Smoke SOAP input',
    });
    const report = await expectStatus('wound generate report', 'POST', `/api/wound-cases/generate-report/${created.woundCaseId}`, 201, {
      title: 'Smoke Complete Wound Report',
      pages: 1,
    });
    created.reportId = report.report.id;
    await expectStatus('wound get reports', 'GET', `/api/wound-cases/get-reports/${created.woundCaseId}`, 200);
    await expectStatus('wound preview report', 'GET', `/api/wound-cases/preview-report/${created.woundCaseId}/${created.reportId}`, 200);
    await expectStatus('wound download report', 'GET', `/api/wound-cases/download-report/${created.woundCaseId}/${created.reportId}`, 200);
    await expectStatus('wound share report', 'PATCH', `/api/wound-cases/share-report/${created.woundCaseId}/${created.reportId}`, 200, {
      email: 'share@example.com',
      name: 'Smoke Share',
    });
    await expectStatus('wound add report', 'PATCH', `/api/wound-cases/add-report/${created.woundCaseId}`, 200, {
      title: 'Smoke Uploaded Report',
    });
    await expectStatus('wound delete image', 'DELETE', `/api/wound-cases/delete-wound-image/${created.woundCaseId}/${created.woundImageId}`, 200);

    await expectStatus('dashboard home', 'GET', `/api/dashboard/home?nurse_id=${nurse.id}&limit=2`, 200);
    await expectStatus('dashboard stats', 'GET', `/api/dashboard/stats?nurse_id=${nurse.id}`, 200);
    await expectStatus('dashboard today tasks', 'GET', `/api/dashboard/today-tasks?nurse_id=${nurse.id}`, 200);
    await expectStatus('dashboard assigned patients', 'GET', `/api/dashboard/assigned-patients?nurse_id=${nurse.id}`, 200);
    await expectStatus('dashboard recent updates', 'GET', `/api/dashboard/recent-updates?nurse_id=${nurse.id}`, 200);

    await expectStatus('profile get', 'GET', `/api/profile/get-profile/${nurse.id}`, 200);
    await expectStatus('profile update', 'PUT', `/api/profile/update-profile/${nurse.id}`, 200, {
      shift: 'Day Shift',
      professional_title: 'RN',
    });
    await expectStatus('profile security settings', 'GET', `/api/profile/security-settings/${nurse.id}`, 200);
    await expectStatus('profile notification preferences get', 'GET', `/api/profile/notification-preferences/${nurse.id}`, 200);
    await expectStatus('profile notification preferences update', 'PATCH', `/api/profile/notification-preferences/${nurse.id}`, 200, {
      task_alerts: true,
    });
    await expectStatus('profile app settings get', 'GET', `/api/profile/app-settings/${nurse.id}`, 200);
    await expectStatus('profile app settings update', 'PATCH', `/api/profile/app-settings/${nurse.id}`, 200, {
      language: 'english',
    });
    await expectStatus('profile patient handoff', 'POST', `/api/profile/patient-handoff/${nurse.id}`, 200, {
      to_nurse_id: nurseTwo.id,
      patient_ids: [patient.patient.id],
    });

    await expectStatus('handoff patients', 'GET', `/api/handoffs/patients/${nurse.id}`, 200);
    await expectStatus('handoff available nurses', 'GET', `/api/handoffs/available-nurses/${nurse.id}`, 200);
    const handoff = await expectStatus('handoff create', 'POST', '/api/handoffs/create', 201, {
      from_nurse_id: nurse.id,
      patient_ids: [handoffPatient.patient.id],
      shift_label: 'Evening',
    });
    created.handoffId = handoff.handoff.id;
    await expectStatus('handoff get', 'GET', `/api/handoffs/get/${created.handoffId}`, 200);
    await expectStatus('handoff select nurse', 'PATCH', `/api/handoffs/select-nurse/${created.handoffId}`, 200, {
      to_nurse_id: nurseTwo.id,
    });
    await expectStatus('handoff notes', 'PATCH', `/api/handoffs/notes/${created.handoffId}`, 200, {
      general_notes: 'Smoke handoff notes',
      per_patient_notes: { [handoffPatient.patient.id]: 'Monitor closely' },
    });
    await expectStatus('handoff confirm', 'PATCH', `/api/handoffs/confirm/${created.handoffId}`, 200);
    await expectStatus('handoff success', 'GET', `/api/handoffs/success/${created.handoffId}`, 200);

    const notification = await expectStatus('notification create', 'POST', '/api/notifications/create-notification', 201, {
      user_id: nurse.id,
      type: 'wound_update',
      title: 'Smoke Notification',
      message: 'Smoke notification message',
      action_label: 'View',
      action_url: '/smoke',
    });
    created.notificationId = notification.notification.id;
    await expectStatus('notification get user', 'GET', `/api/notifications/get-notifications/${nurse.id}`, 200);
    await expectStatus('notification get all', 'GET', '/api/notifications/get-notifications?limit=1', 200);
    await expectStatus('notification mark read', 'PATCH', `/api/notifications/mark-read/${created.notificationId}`, 200);
    await expectStatus('notification mark all read', 'PATCH', `/api/notifications/mark-all-read/${nurse.id}`, 200);
    await expectStatus('notification clear', 'DELETE', `/api/notifications/clear/${created.notificationId}`, 200);
    await expectStatus('notification clear all', 'DELETE', `/api/notifications/clear-all/${nurse.id}`, 200);

    await expectStatus('profile change password', 'PATCH', `/api/profile/change-password/${nurse.id}`, 200, {
      current_password: 'Password123!',
      new_password: 'Password1234!',
      confirm_password: 'Password1234!',
    });
    await expectStatus('profile sign out all devices', 'PATCH', `/api/profile/sign-out-all-devices/${nurse.id}`, 200);
    await expectStatus('profile sign out', 'POST', `/api/profile/sign-out/${nurse.id}`, 200);
    await expectStatus('profile delete account', 'DELETE', `/api/profile/delete-account/${nurse.id}`, 200, {
      password: 'Password1234!',
      confirm_delete: true,
      reason: 'Smoke test cleanup',
    });

    await expectStatus('wound delete case', 'DELETE', `/api/wound-cases/delete-wound-case/${created.woundCaseId}`, 200);
    created.woundCaseId = null;
    await expectStatus('task delete', 'DELETE', `/api/tasks/delete-task/${created.taskId}`, 200);
    created.taskId = null;
    await expectStatus('patient delete', 'DELETE', `/api/patients/delete-patient/${patient.patient.id}`, 200);
    created.patientIds = created.patientIds.filter((id) => id !== patient.patient.id);

    const failed = results.filter((result) => !result.ok);
    console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
  } finally {
    server.kill();
    await cleanup();
    await sequelize.close();
  }
};

main().catch(async (error) => {
  console.error(error);
  try {
    await cleanup();
    await sequelize.close();
  } catch (cleanupError) {
    console.error(cleanupError);
  }
  process.exit(1);
});
