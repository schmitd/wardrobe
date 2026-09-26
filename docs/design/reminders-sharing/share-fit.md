# Share the fit photo

Reviewed implementation contract for [#108](https://github.com/schmitd/wardrobe/issues/108). A user chooses **Share fit** from fit detail and hands an image to the device's normal sharing system. Sharing has no effect on wear confirmation, ownership or social state.

## Interaction

Use a familiar share icon with an accessible label on the saved photo. If the derivative is ready, native opens the OS sheet directly. If preparation is necessary, show a small image preview and **Preparing image…**, then a ready **Share image** action. A web share that needs new user activation waits for that tap. Avoid a caption form, destination picker inside Wardrobe, or a new top-level screen.

The source photo is selected explicitly by the user; if an occurrence has multiple photos, share the currently viewed photo. Export photo pixels with original framing and corrected orientation. Do not silently share a garment crop, app screenshot, recognition labels, calendar details or signed storage URL. No watermark or caption by default.

There is no Wardrobe feed, follower graph, address-book import, public profile, public image hosting, share link or delivery backend. Apps and contact suggestions belong to the system sheet. Wardrobe does not need contacts permission and does not collect which person/app was chosen.

## Image preparation

1. Confirm current account ownership/authorization of the selected stored photo. Revalidate if a prepared derivative survives an account change or photo deletion. Deduplicate simultaneous share requests in the UI.
2. Produce a derivative with orientation baked into pixels and sensitive metadata removed, including EXIF location/device/timestamps where present. Preserve framing; keep original resolution up to a documented practical memory/file-size limit, avoid upscaling, and describe any necessary downscale. Use JPEG for ordinary opaque photos or PNG when appropriate; image-copy on web normally uses PNG.
3. Present the same derivative pixels that will be exported. A download URL is private transport for authorized fetching only, not the shared object. Never expose a public URL as a workaround for a missing share API.
4. Cache native files privately with a random nonidentifying filename and truthful MIME/UTI; scope to account and source revision. Do not delete a file while the receiving app may still read it. Bound TTL and clean up after supported handoff completion, cancel/failure, logout and next-launch sweep. Proposed maximum cache age: 24 hours, subject to device handoff tests. Purge immediately on account deletion when safe and revoke access regardless.
5. On web, hold Blob/File objects only as needed; revoke object URLs and release image buffers after use. Do not put signed URLs or photo bytes in analytics or logs. Offline sharing works only when an authorized usable derivative is already cached; otherwise explain that the photo needs to load.

The image itself may contain recognizable people/backgrounds; metadata stripping does not anonymize pixels. The user sees what they are choosing to share. No automatic face editing or unrequested crop is part of this feature.

## Platform contract

| Platform | Primary action | Clipboard / fallback | Important boundary |
| --- | --- | --- | --- |
| iOS | Native share sheet via compatible `expo-sharing` local file URI; correct image UTI and tablet anchor | OS Copy/Save when available; explicit Copy image only if image API supported | Targets/actions vary; sheet dismissal is neutral |
| Android | Native Sharesheet via compatible image-file adapter with correct MIME and readable temporary URI | Capability-tested image clipboard, otherwise system targets / save flow | Do not share text/file URL in place of image bytes |
| Web with file sharing | `navigator.canShare({ files: [file] })` then `navigator.share({ files: [file] })` under user activation | Optional Copy image / Download image | HTTPS and capability/permission checks; preserve activation |
| Web without file sharing | Copy image if supported; otherwise Download image | `ClipboardItem` with supported image type and `navigator.clipboard.write` | Copy pixels, never `writeText(photoUrl)` |

[Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) supports native local files, while its web URI limitations require a separate browser Blob/File path here. [MDN Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) documents capability checks, user activation and platform-dependent completion. Do not claim recipient delivery from the resolved promise.

Use an explicit image clipboard API only when available and tested; [Expo Clipboard](https://docs.expo.dev/versions/latest/sdk/clipboard/) is the native candidate to verify against SDK 57. On web, [Clipboard.write](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write) can write image data, commonly PNG, subject to browser security requirements. Do not read the clipboard or pasteboard for this task.

## States and feedback

| State | UI response |
| --- | --- |
| Preparing | Preview and bounded progress/loading state; cancel remains available |
| Ready | One enabled share action; copy/download only where useful/supported |
| System sheet open | Keep source route stable; avoid concurrent share actions |
| Cancel / AbortError | Return quietly to the photo; no red failure toast or automatic retry |
| Clipboard success | **Image copied** only after image write succeeds |
| Share handoff | Return to detail; avoid **Sent** or **Delivered** claims |
| API unavailable / permission denied | Explain briefly; provide copy/download or retry where applicable |
| Image inaccessible/deleted/signed out | No export; return to current authorized state |
| Memory/size/encoding failure | Retain original; offer bounded retry or documented smaller derivative |

## Verification and release

Image export and web/native adapters are implemented; see [implementation.md](implementation.md) for verified web behavior and remaining native gates. Before release, demonstrate:

- Actual image arrival in another installed app on iOS and Android, correct orientation/framing, MIME handling and tablet presentation; cancellation returns to the original fit.
- Web mobile/desktop file-share supported and unsupported cases, user-gesture expiry during preparation, clipboard denied/unavailable, image paste into another app, and a valid download fallback.
- Metadata removed from the exported derivative, full garment framing preserved, no unrequested labels/watermark, source file unchanged.
- Large/rotated images, slow network, cached offline file, source deletion, logout/account switch during preparation and repeated taps handled without leaking another account's image.
- Temporary files/Blob memory cleaned within policy without breaking delayed recipient reads.
- Existing photo masking and content-free analytics remain intact. Count coarse outcomes only if consented; never recipient/app names, filenames, photo IDs, image content or exported URLs.

Native package/config changes require SDK compatibility and installed-runtime verification. Do not claim an OTA update can add a missing native module. Keep the implementation PR draft; verify real platform behavior before closing #108.
