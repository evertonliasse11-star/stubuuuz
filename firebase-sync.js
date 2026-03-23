/* ==============================================
   STUBUU - Firebase Sync Module
   Handles authentication and cloud data persistence
============================================== */

const firebaseConfig = {
    apiKey: "AIzaSyCSaLi3dM1S_Kkr1UPr95AUFNaqC1uxLio",
    authDomain: "stubuu-bbc6b.firebaseapp.com",
    projectId: "stubuu-bbc6b",
    storageBucket: "stubuu-bbc6b.firebasestorage.app",
    messagingSenderId: "603024383149",
    appId: "1:603024383149:web:8bc7a21a2cb3bff23a7a24",
    measurementId: "G-HKP970NJ14"
};

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let _saveTimeout = null;

/* --- INITIALIZATION --- */
function initFirebase() {
    try {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
        console.log('[Firebase] Initialized successfully');
    } catch (e) {
        console.error('[Firebase] Initialization error:', e);
    }
}

/* --- AUTH FUNCTIONS --- */
async function firebaseSignUp(email, password) {
    if (!firebaseAuth) return { user: null, error: 'Firebase not initialized' };

    try {
        const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Create initial user_data document in Firestore
        await firebaseDb.collection('user_data').doc(user.uid).set({
            settings: {},
            tasks: [],
            schedule: {},
            resources: [],
            progress: {},
            reflections: [],
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { user, error: null };
    } catch (e) {
        return { user: null, error: e.message };
    }
}

async function firebaseSignIn(email, password) {
    if (!firebaseAuth) return { user: null, error: 'Firebase not initialized' };

    try {
        const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
        return { user: userCredential.user, error: null };
    } catch (e) {
        return { user: null, error: e.message };
    }
}

async function firebaseSignOut() {
    if (!firebaseAuth) return { error: 'Firebase not initialized' };

    try {
        await firebaseAuth.signOut();
        return { error: null };
    } catch (e) {
        return { error: e.message };
    }
}

function getFirebaseUser() {
    if (!firebaseAuth) return null;
    return firebaseAuth.currentUser;
}

/* --- DATA SYNC FUNCTIONS --- */

/**
 * Load all user data from Firestore.
 * Returns an object with settings, tasks, schedule, resources, progress, reflections
 * or null if no data found / not authenticated.
 */
async function loadFromFirebase() {
    if (!firebaseDb) return null;

    const user = getFirebaseUser();
    if (!user) return null;

    try {
        const doc = await firebaseDb.collection('user_data').doc(user.uid).get();

        if (!doc.exists) {
            console.log('[Firebase] No data document yet for this user');
            return null;
        }

        console.log('[Firebase] Data loaded successfully');
        return doc.data();
    } catch (e) {
        console.error('[Firebase] Load error:', e);
        return null;
    }
}

/**
 * Save all user data to Firestore.
 * @param {Object} allData - { settings, tasks, schedule, resources, progress, reflections }
 */
async function saveToFirebase(allData) {
    if (!firebaseDb) return;

    const user = getFirebaseUser();
    if (!user) return;

    try {
        await firebaseDb.collection('user_data').doc(user.uid).set({
            settings: allData.settings || {},
            tasks: allData.tasks || [],
            schedule: allData.schedule || {},
            resources: allData.resources || [],
            progress: allData.progress || {},
            reflections: allData.reflections || [],
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('[Firebase] Data saved successfully');
    } catch (e) {
        console.error('[Firebase] Save error:', e);
    }
}

/**
 * Debounced save — waits 2 seconds after last call before actually saving.
 * This avoids hammering the database on rapid changes.
 */
function debouncedSaveToFirebase(allData) {
    if (_saveTimeout) clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
        saveToFirebase(allData);
    }, 2000);
}

/**
 * Helper: call this from any save function in script.js to trigger a cloud sync.
 * Collects all current data and saves to Firebase.
 */
function triggerCloudSync() {
    if (!firebaseDb) return;

    // These globals are defined in script.js
    if (typeof settings === 'undefined') return;

    const allData = {
        settings: settings,
        tasks: tasks,
        schedule: schedule,
        resources: resources,
        progress: progress,
        reflections: reflections
    };

    debouncedSaveToFirebase(allData);
}
