# `apps/web` Local Emulator Guide

This guide covers setting up and running the `apps/web` application against the local Firebase emulator suite.

## Prerequisites

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```
2.  **Install Firebase CLI:**
    If you don't have it, install it globally:
    ```bash
    npm install -g firebase-tools
    ```
    Then log in:
    ```bash
    firebase login
    ```

## Running the Emulator Environment

1.  **Start the Emulators:**
    This command starts the Auth and Firestore emulators and the Emulator UI. It imports data from `./.seed` on startup and exports data to the same directory on exit.

    ```bash
    pnpm -F web emu:start
    ```
    - **Auth Emulator:** `127.0.0.1:9099`
    - **Firestore Emulator:** `127.0.0.1:8080`
    - **Emulator UI:** `http://localhost:4000`

2.  **Seed the Database:**
    In a separate terminal, run this command to create a test user and their corresponding Firestore document.

    ```bash
    pnpm -F web emu:seed
    ```
    - **User:** `test@example.com`
    - **Password:** `password123`

3.  **Run the Web App:**
    With the emulators running, start the Next.js development server.

    ```bash
    pnpm -F web dev
    ```
    - Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded user credentials.

## Testing

- **Run Unit Tests (No Emulators Required):**
  ```bash
  pnpm test:ci
  ```

- **Run Emulator-Dependent Tests:**
  Ensure the emulators are running before executing this command.
  ```bash
  pnpm -F web emu:test
  ```

## Troubleshooting

- **Port Conflict:** If an emulator fails to start, another process might be using the required port. Find and kill the process, or reconfigure the ports in `firebase.json`.

- **`auth/invalid-api-key`:** This usually means the web app is not configured to talk to the emulator. Ensure `NEXT_PUBLIC_USE_EMULATORS=true` is set in your `.env.local` file and that the app was restarted after the change.

- **Permission Denied / 403 Errors:** If the seeder script fails with a permission error, verify that `FIRESTORE_EMULATOR_HOST` is correctly set and that the script is sending `Authorization: Bearer owner` in its requests to Firestore to bypass security rules.

- **Resetting Emulator Data:** To start with a clean slate, stop the emulators, delete the `./.seed` directory, and then restart the emulators. The `--import` flag will not find any data, and a fresh set will be created on exit.

## Data Persistence

The `emu:start` script uses `--import=./.seed --export-on-exit`. This means:
- On startup, data from the `apps/web/.seed` directory is imported into the emulators.
- On shutdown (e.g., using `Ctrl+C`), the current state of the emulators is saved back to that directory.

This allows user data and database state to persist between sessions.