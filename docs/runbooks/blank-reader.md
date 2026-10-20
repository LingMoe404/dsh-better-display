# Blank reader, missing stylesheet, stuck fold

These three show up in CHANGELOG as real failures. There is no dashboard to open. Look at the host page and the versions below.

## Blank reader

0.3.8 (#60) re-injects the plugin stylesheet when a session switch clears it, because that clear left a blank page. `ensureStyles` in `src/client/styles.ts` remembers `style[data-plugin="dsh-better-display"][data-plugin-css]` and puts a missing tag back on `document.head`. The client entry calls it while the module loads (`src/client/index.tsx`), and `Reader` calls it again from `useInsertionEffect` before paint.

A page that never becomes the reading view is a different failure. 0.3.1 threw while booting because `conversation.chat.turnTail` had become a list slot, and the host stayed on “Failed to load plugins”. 0.3.7 shipped a host entry that imported `./skill-roots.ts`; the host died with `ERR_MODULE_NOT_FOUND` while the market still showed the plugin installed. 0.3.8 stops externalising those relative host imports. Reinstalling the broken 0.3.7 build does not fix that.

Check, in order:

1. Reopen the Web Host and reload. The bundle is read at boot.
2. If the host says “Failed to load plugins”, read that error. Do not toggle auto-fold. A slot mismatch or `ERR_MODULE_NOT_FOUND ./skill-roots.ts` means the installed build never reached `Reader`.
3. In the document, look for `style[data-plugin="dsh-better-display"]`. If the reading column is mounted and those tags are missing, the stylesheet was cleared before `ensureStyles` had stored it. Reload so the client entry runs again.

## Missing stylesheet

The same 0.3.8 note (#60) is the stylesheet case: the session switch removes the plugin style tags, the reading column is still there, and it paints without the reader sheet. `ensureStyles` can only restore tags it has already seen. If `document.head` has no `data-plugin-css` node for this plugin and the in-memory map is empty, there is nothing to put back until the entry runs again.

Confirm the host did not mount the plugin twice. A hand-written `cordis.patch.yml` insert plus `dsh plugin add` loads two copies. Reload after a single install. Do not add a second stylesheet link.

## Stuck fold

0.2.0: the fold choreography advanced only on animation promises and rendered frames. A cancelled animation rejects, and a hidden tab delivers no frames. The machine stayed in a non-idle phase, the frame source stayed on the shown snapshot, and the text reveal paused, so the turn looked stuck until the view remounted. Each phase now has a wall-clock deadline. In `src/client/fold-choreography.ts`, `watchdogSlack` is 240ms added to the phase duration (`collapse` 320, `count` 160, `settle` 80, `reveal` 180). `ChoreographedFlow` fires that deadline with `setTimeout` and moves the phase even when `onfinish` never runs.

The same release gave disclosures a deadline. `fill: 'both'` pins the opening keyframe, so a Web Animation that never reaches `onfinish` left the row at zero height and zero opacity. A click looked like nothing happened. Later deadlines in `motion.tsx` and `ReasoningCard.tsx` use the same 240ms slack on top of the animation length.

0.3.5: a finished expand animation has to release back to the row’s natural height. Content that changed after expanding left blank space or clipped steps until refresh. The collapse animation stays until React removes the content, so it does not flash for one frame.

0.3.8 (#60) adds a timeout fallback for retiring content animations so they complete instead of holding the row.

0.3.0: turning auto-fold off, opening process detail, then turning it on again used to leave the process expanded. Turning it on restores the auto-fold rules. Text selection protection and a later manual expand still win. The switch is on the reading toolbar and in Settings. The root store key is `dsh.reader.v1`; `foldIntensity` 0 is off, 1 is the default fold, 2 folds process runs into a digest and does not fold prose.

Check, in order:

1. Settings shows auto-fold on. Off means thinking and tools stay expanded. That is not a stuck animation.
2. Wait out the phase plus 240ms. A row still at zero height after that should have been settled by the deadline. Reload the reading view once. The pre-0.2.0 recovery was a remount, and a deadline that did not run is the bug to report.
3. Say whether the tab was in the background and whether `prefers-reduced-motion` is set. Do not restyle `Reader` to force the row open.
