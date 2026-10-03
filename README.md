# Sabr: phone-as-lightsaber demo

The big screen runs the game. A phone scans the QR code and becomes the saber, using its gyroscope.

- `index.html` + `game.js`: the game screen (Three.js, bloom, slicing, synthesized audio)
- `controller.html`: the phone controller page (sends device orientation)
- Connection: WebRTC peer-to-peer through PeerJS (the public PeerJS cloud handles signaling), so it is a fully static site with no backend

## Run / deploy

Phones only expose motion sensors over **HTTPS**, so test through a deployed URL.

```
npx vercel --prod
```

Local preview (game screen + mouse mode only): `npx http-server -p 5173` and open http://localhost:5173.
Add `?debug` to expose `window.__sabr` for console testing.

## Controls

- Phone: hold it like a sword hilt with the top pointing at the screen. Tap the phone screen to recenter. Tap a color dot to change the blade color.
- Keyboard on the game screen: `C` or `Space` recenters, `M` switches to mouse mode.

## Known limits (demo)

- Rotation only. The saber pivots around a fixed hand point; moving the phone sideways without rotating does nothing.
- Yaw drifts slowly, so recenter when needed.
- Relies on the free PeerJS cloud broker. If it is down, the controller cannot connect.
- Vibration on hit works on Android only.
