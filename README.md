# RepRank — Workout Tracker

An installable web app (PWA) for tracking workouts on your phone. No account, no app store; all data stays on your device.

## Features
- **Onboarding survey**: goal, experience, schedule, equipment, focus areas, injuries and current lifts. It builds a plan for you.
- **A workout every day**: rotates muscle groups (e.g. Chest → Back → Legs → Shoulders → Arms). Finish a workout and the next day in the rotation is up. Skip, swap exercises, or pick a different day any time.
- **Smart suggestions**: weights based on your last session (progressive overload) or your PRs.
- **PR tracking**: PRs are detected automatically while you log sets, and you can also add them by hand.
- **Muscle ranks**: a body diagram colored by rank (Iron → Bronze → Silver → Gold → Platinum → Diamond → Elite → Legend), based on estimated 1RM ÷ bodyweight.
- **Body tab**: weight log with a trend chart, height, and BMI.
- **Notifications**: daily workout reminder, new PRs, rank-ups, weekly goal, and the rest timer.
- Works offline; export/import a backup.

## Run locally
```
python3 -m http.server 8000
```
Open http://localhost:8000. Any static host works (Netlify, GitHub Pages, …).

## Install on your phone
- **iPhone**: open in Safari → Share → *Add to Home Screen*. Notifications need iOS 16.4+ and the app added to the Home Screen.
- **Android**: open in Chrome → ⋮ → *Install app*.
