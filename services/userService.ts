const USER_NAME_KEY = "aidlex_user_name";
const AUTH_STATUS_KEY = "aidlex_auth_status";
const USER_EMAIL_KEY = "aidlex_user_email";


export type AuthStatus = 'guest' | 'authenticated';

/**
 * Retrieves the user's name from local storage.
 * @returns The user's name, or null if not set.
 */
export const getUserName = (): string | null => {
    try {
        return localStorage.getItem(USER_NAME_KEY);
    } catch (error) {
        console.error("Could not access local storage to get user name:", error);
        return null;
    }
};

/**
 * Saves the user's name to local storage.
 * @param name The name to save.
 */
export const setUserName = (name: string): void => {
    try {
        localStorage.setItem(USER_NAME_KEY, name);
    } catch (error) {
        console.error("Could not access local storage to set user name:", error);
    }
};

/**
 * Retrieves the user's authentication status from local storage.
 * @returns The user's status, defaulting to 'guest'.
 */
export const getAuthStatus = (): AuthStatus => {
    try {
        return (localStorage.getItem(AUTH_STATUS_KEY) as AuthStatus) || 'guest';
    } catch (error) {
        console.error("Could not access local storage to get auth status:", error);
        return 'guest';
    }
};

/**
 * Saves the user's authentication status to local storage.
 * @param status The status to save.
 */
export const setAuthStatus = (status: AuthStatus): void => {
    try {
        localStorage.setItem(AUTH_STATUS_KEY, status);
    } catch (error) {
        console.error("Could not access local storage to set auth status:", error);
    }
};

/**
 * Saves the user's contact information to local storage.
 * @param email The user's email.
 */
export const setUserContactInfo = (email: string): void => {
    try {
        localStorage.setItem(USER_EMAIL_KEY, email);
    } catch (error) {
        console.error("Could not access local storage to set user contact info:", error);
    }
};

/**
 * Logs the user out by clearing their data from local storage.
 */
export const logoutUser = (): void => {
    try {
        localStorage.removeItem(USER_NAME_KEY);
        localStorage.removeItem(AUTH_STATUS_KEY);
        localStorage.removeItem(USER_EMAIL_KEY);
    } catch (error) {
        console.error("Could not access local storage to log out user:", error);
    }
};