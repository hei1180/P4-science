# Firebase setup · 北極熊保暖實驗室

This app uses the **same Firebase project as the P1 maths games** so pupils have one Google sign-in. It writes to a new collection, `polarSessions`, and the teacher dashboard reads it.

The app needs steps 1–4 before a real pupil can sign in and save. For a quick look without Firebase, use `/?dev` or `/?guest`; for the dashboard use `teacher.html?demo`.

---

## 1. Add the site domain to Google sign-in

1. Open [Firebase Console](https://console.firebase.google.com/) → project **p1-maths**.
2. **Authentication** → **Settings** → **Authorized domains**.
3. `localhost` is already listed. Add the site domain when you host it:
   * GitHub Pages: `hei1180.github.io`
   * Custom domain: the bare domain, e.g. `science.example.edu.hk`
4. Save. Google sign-in on that domain will now work.

> `auth/unauthorized-domain` in the app means this step has not been done for the current URL.

---

## 2. Publish the merged Firestore rules

The file [`../firestore.rules`](../firestore.rules) is the **complete ruleset for the shared project**: every P1 maths collection **plus** `polarSessions`. Do not publish a polar-only file; that would break the P1 games.

1. Open **Firestore Database** → **Rules**.
2. Copy the whole of `firestore.rules`.
3. In the console only, replace:

   ```text
   TEACHER_EMAIL@example.com
   ```

   with the teacher’s Google email (inside the `isTeacher()` function).
4. Paste the whole file into the console and click **Publish**.

The new rule:

* lets a signed-in pupil **create/update only their own** `polarSessions` record;
* lets the teacher account **read every** record;
* validates the field shape and list sizes;
* leaves all P1 rules untouched.

> The rules file is the one place the real teacher email is typed. Do not commit that edit to GitHub; keep the placeholder in the repo.
>
> This file is a snapshot of the shared P1 rules plus the `polarSessions` section. If the P1 maths rules change later, re-copy the P1 rules and append the `polarSessions` block again rather than replacing the whole file with a polar-only ruleset.

---

## 3. Check the teacher hash

The dashboard only shows data if the signed-in email matches a SHA-256 hash in `src/firebase.js`:

```js
export const TEACHER_EMAIL_HASHES = [
  '852963690b...',
];
```

The current hash is the same teacher account used by the P1 games. If you change teacher account:

```bash
printf '%s' 'teacher@example.com' | shasum -a 256
```

Copy the 64-character hash into the array. Then use the same address in the Firestore rule (step 2).

---

## 4. Provide the Firebase web config

The real web config is deliberately **not** in this repository.

* **Deployed site:** the GitHub Actions workflow `.github/workflows/pages.yml` reads the repository secret **`FIREBASE_CONFIG`** (a JSON object with `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `measurementId`) and writes `src/firebase-config.js` before deploying. The secret is already set for this repo; a fresh clone needs it recreated with `gh secret set FIREBASE_CONFIG` or GitHub → Settings → Secrets and variables → Actions.
* **Local development:** copy `src/firebase-config.example.js` to `src/firebase-config.js`, fill in the values from Firebase Console → Project settings → Your apps, and never commit it. It is gitignored. `?dev` and `?guest` work without it; only real Google sign-in needs it.

A Firebase **web API key is a public client identifier, not a secret** — the deployed JavaScript necessarily contains it. Real protection comes from:

1. Firestore security rules (step 2) and the teacher-only read rule.
2. Restricting the key in Google Cloud Console → APIs & Services → Credentials → the browser key:
   * Application restrictions: **HTTP referrers**
   * Add `https://hei1180.github.io/*` and `http://localhost:8000/*`
   * API restrictions: Identity Toolkit, Cloud Firestore and the Firebase APIs used by the app.

The GitHub secret keeps the key out of the repository and git history; it does not hide it from the browser, which is normal for Firebase web apps.

---

## 5. Test the write and the read

1. Open `http://localhost:8000/?dev`, complete the lesson quickly (or use the dev `⏭` button in the experiment) and finish the report. Dev mode deliberately does **not** write to Firebase.
2. Open `http://localhost:8000/` and sign in with a **pupil** Google account. Complete a short session. In Firebase Console → Firestore → `polarSessions`, a document should appear with the pupil’s uid.
3. Open `http://localhost:8000/teacher.html` and sign in with the **teacher** account. The row should appear. If you get a permission error, the rules from step 2 have not been published, or the email in the rule does not match the account.
4. Click a row to inspect the eye-level angles, capture times and every answer.
5. Use **Sessions CSV** / **Readings CSV** to check the export opens correctly in Excel with Chinese names.

### Common errors

| Message | Fix |
| --- | --- |
| `auth/unauthorized-domain` | Add the current domain in Authentication → Settings → Authorized domains |
| `Missing or insufficient permissions` on save | Publish the merged rules; the user must be signed in |
| Teacher dashboard says “此帳戶沒有教師權限” | The email hash in `src/firebase.js` does not match the account |
| Teacher sees “讀取失敗 … Firestore refused” | The rule from step 2 is missing, or the teacher email in the rule is wrong |
| Login popup closes immediately | Allow popups for the site, or use the redirect fallback (the app tries it automatically) |
| Google sign-in says “Firebase is not configured” | Add `src/firebase-config.js` locally, or set the `FIREBASE_CONFIG` repository secret for the Pages build |
| 3D scene missing | WebGL is blocked; the 2D reading scope and all questions still work, but use Chrome/Safari on a device with WebGL for the full lesson |

---

## 6. Privacy

The record contains the pupil’s Google display name, email, class code, six temperatures, eye angles, capture times and quiz answers. It is visible only to the pupil and the teacher account under the rules. The teacher CSV should be stored in a restricted drive. The app does not use analytics or advertising.

The Firebase web config is injected from the encrypted `FIREBASE_CONFIG` repository secret during the Pages build. It is still visible in the browser bundle by design; security comes from the Firestore rules, Google sign-in, and the API-key restrictions described in step 4.

---

## 7. Hosting later

The app is plain static files — no bundler. GitHub Pages is deployed by `.github/workflows/pages.yml`, which injects the `FIREBASE_CONFIG` secret and uploads the static site. A deploy needs:

* `index.html`, `teacher.html`, `styles.css`, `logic.js`, `questions.js`
* `src/`, `assets/`, `docs/`
* the Firebase authorized domain from step 1
* the rules from step 2
* the `FIREBASE_CONFIG` repository secret from step 4

Open the page at **`https://<account>.github.io/<repo>/`**; do not open `index.html` from the file system. The relative asset paths work under a repository subpath.
