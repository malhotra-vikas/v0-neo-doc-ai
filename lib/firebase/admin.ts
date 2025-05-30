import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

let adminApp: App;
let adminAuth: Auth;

export function getFirebaseAdmin(): Auth {
  if (!adminAuth) {
    if (!getApps().length) {
      try {
        // Read credentials from JSON file
        const serviceAccount = JSON.parse(
          readFileSync(
            join(process.cwd(), 'config', 'firebase', 'config.json'),
            'utf-8'
          )
        );

        adminApp = initializeApp({
          credential: cert(serviceAccount)
        });
      } catch (error) {
        console.error('Error loading Firebase credentials:', error);
        throw new Error('Failed to initialize Firebase Admin SDK');
      }
    }
    adminAuth = getAuth(getApps()[0]);
  }
  return adminAuth;
}