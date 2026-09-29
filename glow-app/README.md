# Glow

A live-streaming and social discovery app prototype built with React Native (Expo SDK 57).
It has five tabs (Home, Discover, Live, Chats, Profile) plus stories, live viewers with
comments/hearts/gifts, chats with replies, video calls, search, notifications, settings and a
coin wallet. All data is sample data kept in memory, so nothing is sent anywhere.

---

## Option 1: Get an APK with GitHub (no Android Studio needed)

This project includes a GitHub Actions workflow that builds the APK on GitHub's servers for free.

1. Create a free account at github.com if you don't have one.
2. Create a **new repository** (it can be private).
3. Upload the project:
   - **Easiest:** with Git installed, run these in the project folder:
     ```
     git init
     git add .
     git commit -m "Glow app"
     git branch -M main
     git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
     git push -u origin main
     ```
   - **Or in the browser:** on the repo page choose **Add file → Upload files** and drag in
     everything from this folder. The browser upload may skip the hidden `.github` folder.
     If it does, choose **Add file → Create new file**, name it
     `.github/workflows/build-apk.yml`, paste in the contents of that file from this project
     and commit.
4. Open the **Actions** tab. The "Build Android APK" run starts automatically after each push.
   You can also start it with **Run workflow**. It takes about 10–15 minutes.
5. When it shows a green tick, open the run and download **glow-apk** under *Artifacts*.
   It's a zip file with `app-release.apk` inside.
6. Copy the APK to your phone and open it. Android will ask you to allow installs from this
   source (your browser or file manager). Allow it and install.

> The APK is signed with a development key. That's fine for installing on your own phone,
> but you'll need your own signing key before publishing to the Play Store.

## Option 2: Try it right away with Expo Go (no build)

1. Install **Node.js 20 or newer** on your computer (nodejs.org).
2. Install **Expo Go** from the Play Store on your phone.
3. In this folder run:
   ```
   npm install
   npx expo start
   ```
4. Scan the QR code with Expo Go. Your phone and computer need to be on the same Wi-Fi.
   If they aren't, run `npx expo start --tunnel` instead.

## Option 3: Build with Expo's cloud (EAS)

```
npm install
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile apk
```
When the build finishes, EAS gives you a link to download the APK. The free plan works, but
builds sometimes wait in a queue.

## Option 4: Build on your own computer

This needs Android Studio (with the Android SDK) and JDK 17.
```
npm install
npm run build:apk
```
The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

---

## Project layout

```
App.js            app shell: header, tab bar, toasts, back-button handling
src/theme.js      colours, fonts, shadow
src/data.js       sample users, lives, chats, stories, gifts
src/store.js      in-memory state, modal stack, toast, chat replies
src/ui.js         text, icons, avatars, buttons, pulse rings
src/components.js live cards, match cards, user rows
src/screens.js    the five tab screens
src/modals.js     every overlay: profile, live viewer, story, chat, call, search, settings…
```

To change names, messages or streams, edit `src/data.js`.
To change the colours, edit `src/theme.js`.
