import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirebaseConfig } from '../config/firebase';

type App = ReturnType<typeof initializeApp>;
type AuthClient = ReturnType<typeof getAuth>;

let firebaseApp!: App;
let firebaseAuth!: AuthClient;
let googleProvider!: GoogleAuthProvider;
let firebaseAppInit = false;
let firebaseAuthInit = false;
let googleProviderInit = false;

export function getFirebaseApp(): App {
	if (firebaseAppInit) return firebaseApp;
	firebaseApp = getApps()[0] ?? initializeApp(getFirebaseConfig());
	firebaseAppInit = true;
	return firebaseApp;
}

export function getFirebaseAuth(): AuthClient {
	if (firebaseAuthInit) return firebaseAuth;
	firebaseAuth = getAuth(getFirebaseApp());
	firebaseAuthInit = true;
	return firebaseAuth;
}

export function getGoogleProvider(): GoogleAuthProvider {
	if (googleProviderInit) return googleProvider;
	googleProvider = new GoogleAuthProvider();
	googleProvider.setCustomParameters({ prompt: 'select_account' });
	googleProviderInit = true;
	return googleProvider;
}
