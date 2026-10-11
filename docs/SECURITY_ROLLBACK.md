# Emergency Security Rules Rollback Guide

If the application breaks or encounters unexpected permission errors after deploying the strict rules, follow these rollback steps immediately.

---

## 1. Soft Rollback (Authenticated Users Allowed)
If only specific collections fail, but you still want to protect against unauthenticated public access, deploy this:

1. Open **[Firebase Console](https://console.firebase.google.com)** ➔ `vehicles-7ad89`
2. Go to **Firestore Database** ➔ **Rules** tab
3. Replace existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
4. Click **Publish**.

---

## 2. Emergency Full Rollback (Open Mode - Temporary Only)
If the entire system is down and you urgently need to keep the shop running while investigating:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
*(⚠️ WARNING: This makes the database public. Re-deploy the strict rules as soon as the issue is resolved).*
