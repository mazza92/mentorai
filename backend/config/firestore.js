/**
 * Firestore Configuration
 * Centralized Firestore initialization with support for Railway environment variables
 */

const { Firestore } = require('@google-cloud/firestore');

let firestore = null;
let useMockMode = false;

function initializeFirestore() {
  if (firestore !== null) {
    return { firestore, useMockMode };
  }

  try {
    if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
      const firestoreConfig = {
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      };

      // Handle credentials from Railway environment variable
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        try {
          const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
          firestoreConfig.credentials = credentials;
          console.log('✅ Using Google Cloud credentials from environment variable');
        } catch (error) {
          console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error.message);
          throw error;
        }
      } else {
        console.warn('⚠️  GOOGLE_CLOUD_PROJECT_ID is set but no credentials found');
        console.warn('   Add GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable');
        console.warn('   Or set GOOGLE_CLOUD_PROJECT_ID=your_project_id to use mock storage');
        throw new Error('Missing Google Cloud credentials');
      }

      firestore = new Firestore(firestoreConfig);
      useMockMode = false;
      console.log('✅ Firestore initialized successfully');
    } else {
      useMockMode = true;
      console.log('Google Cloud not configured, using mock storage for development');
    }
  } catch (error) {
    useMockMode = true;
    firestore = null;
    console.log('Google Cloud initialization failed, using mock storage for development');
    console.log('Error:', error.message);
  }

  return { firestore, useMockMode };
}

module.exports = {
  initializeFirestore,
  getFirestore: () => {
    if (firestore === null && !useMockMode) {
      return initializeFirestore();
    }
    return { firestore, useMockMode };
  }
};
