import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import config from './firebase-applet-config.json';

const app = initializeApp(config);
const db = getDatabase(app);

async function inspect() {
  const root = await get(ref(db, '/'));
  if (!root.exists()) return;
  const data = root.val();

  console.log('=== SCHOOLS ===');
  console.log(JSON.stringify(data.schools, null, 2));

  console.log('=== TEACHERS ===');
  console.log(JSON.stringify(data.teachers, null, 2));

  console.log('=== TEACHER SIGNUPS ===');
  console.log(JSON.stringify(data.teacherSignups, null, 2));

  console.log('=== SCHOOL ADMINS ===');
  console.log(JSON.stringify(data.schoolAdmins, null, 2));

  console.log('=== USERS ===');
  console.log(JSON.stringify(data.users, null, 2));

  console.log('=== GMAIL AND PASSWORD ===');
  console.log(JSON.stringify(data['Gmail and Password'], null, 2));

  console.log('=== EMAIL ACCOUNTS ===');
  console.log(JSON.stringify(data.email_accounts, null, 2));
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
