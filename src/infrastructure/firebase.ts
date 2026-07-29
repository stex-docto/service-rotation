import { FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth'
import {
    Firestore,
    connectFirestoreEmulator,
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from 'firebase/firestore'

const APP_NAME = 'service-rotation'

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
}

export class Firebase {
    private static instance: Firebase
    app: FirebaseApp
    auth: Auth
    firestore: Firestore

    private constructor() {
        // Check if Firebase app already exists
        const existingApps = getApps()
        const existingApp = existingApps.find(app => app.name === APP_NAME)

        if (existingApp) {
            this.app = existingApp
            this.auth = getAuth(this.app)
            this.firestore = getFirestore(this.app)
        } else {
            this.app = initializeApp(firebaseConfig, APP_NAME)
            this.auth = getAuth(this.app)
            this.firestore = initializeFirestore(this.app, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            })

            if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
                connectAuthEmulator(this.auth, 'http://localhost:9099', { disableWarnings: true })
                connectFirestoreEmulator(this.firestore, 'localhost', 8080)
            }
        }
    }

    public static getInstance(): Firebase {
        if (!Firebase.instance) {
            Firebase.instance = new Firebase()
        }
        return Firebase.instance
    }
}
