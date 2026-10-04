# Horizon Blade: phone-as-lightsaber co-op game

A game by AFAQ Scientific Club. The big screen runs the game. Up to 4 players scan the QR code, and each phone becomes a saber using its gyroscope.

- `index.html` + `game.js`: the game screen (Three.js, bloom, slicing, synthesized music and sound effects)
- `controller.html`: the phone controller page (sends device orientation, shows team stats)
- Connection: WebRTC peer-to-peer through PeerJS (the public PeerJS cloud handles signaling), so it is a fully static site with no backend and no accounts

## Gameplay

- Co-op: every player cuts the same cubes. The team shares score, combo and health.
- Back-to-back cuts by different players within 1.2s earn a **TEAM** bonus.
- Dot cubes: cut any way. Arrow cubes: cut in the arrow's direction for PERFECT (wrong way scores less and doesn't add to the combo).
- Bombs: don't touch them. Gold cubes: heal the team.
- Missing a cube costs health (half damage in the first 20 seconds). Health 0 = game over with per-player results.
- Players can join mid-game using the small QR code in the corner.

## Run / deploy

Phones only expose motion sensors over **HTTPS**, so test through a deployed URL.

```
npx vercel --prod
```

Local preview (game screen + mouse player only): `npx http-server -p 5173` and open http://localhost:5173.
Add `?debug` to expose `window.__sabr` for console testing.

## Controls

- Phone: hold it like a sword hilt with the top pointing at the screen. Tap the phone screen to recenter. START / PLAY AGAIN buttons, color dots, Reconnect button.
- Game screen keyboard: `Enter` start, `C` / `Space` recenter everyone, `M` add or remove a mouse player, `Esc` back to lobby.

## Reconnecting

- Each phone keeps a stable id, so a reconnect gets the same slot, color and stats back.
- The phone retries automatically, waiting a bit longer each time. The Reconnect button retries immediately.
- The game screen keeps a dropped player's saber for 4 seconds, so quick reconnects don't flicker.
- The room code survives a reload of the game screen.

## Known limits

- Rotation only. Each saber pivots around a fixed hand point; moving the phone sideways without rotating does nothing.
- Yaw drifts slowly, so recenter when needed.
- Relies on the free PeerJS cloud broker. If it is down, phones cannot connect.
- Vibration works on Android only.
