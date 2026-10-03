# Local audio routing

The audio engine plays imported WAV files and Gemini generated WAV through the selected output using Chromium's `setSinkId`. This provides the signal that a meeting app receives as a microphone. Stop/Escape pauses and rewinds the clip; Replay/Ctrl+R starts it again.

## Browser / Edge setup with VB-CABLE

1. Install [VB-Audio VB-CABLE](https://vb-audio.com/Cable/) on Windows and restart Windows if the installer asks.
2. Reopen NEB Voice Console and press the refresh icon in **Voce e audio → Uscita audio**. Its output list must contain **CABLE Input (VB-Audio Virtual Cable)**.
3. In NEB, choose **CABLE Input** as the output device. This sends generated speech into the virtual cable instead of speakers.
4. In the Edge site where the AI conversation runs, open its microphone/device settings and choose **CABLE Output (VB-Audio Virtual Cable)**. Keep Windows speakers on the real headset so you can hear the model.
5. In NEB, open **Modalità conversazione**, paste a short sentence and press **Pronuncia**. The browser's microphone test or conversation should receive the synthesized voice.

For a guided check in the full Console, open **Test audio e istruzioni** under **Voce e audio → Uscita audio**. Select CABLE Input in NEB, select CABLE Output as the microphone in Edge, start Edge's microphone test or recording, then press **Pronuncia frase di prova** in NEB. Listen to the recording to confirm the phrase arrived. The test phrase does not replace your script. NEB can verify only its selected output; it cannot detect or verify Edge's microphone selection. If a saved output is disconnected, refresh the device list; when CABLE Input is detected, **Usa CABLE Input** selects it again.

Teams uses the same pairing: choose **CABLE Input** in NEB and **CABLE Output** as the Teams microphone.

## Hear the generated voice in headphones

Keep Windows' normal output device set to the real headset. NEB alone uses **CABLE Input**, so its signal otherwise enters the virtual cable without reaching the headphones. To monitor it:

1. Press `Win + R`, enter `mmsys.cpl`, then press Enter.
2. Open the **Recording** tab and double-click **CABLE Output (VB-Audio Virtual Cable)**.
3. Open **Listen** and enable **Listen to this device**.
4. Under **Playback through this device**, choose the real headset, for example **Cuffie (Neb - Jabra Evolve2 65)**. Click **Apply** then **OK**.

This does not change the browser microphone: Edge continues to receive **CABLE Output**, while Windows also sends a local copy to the selected headset. There can be a small monitoring delay. If you ever hear an echo, make sure the browser's speaker remains the headset and that it is not also playing into the virtual cable.

Some browser apps may suppress or alter audio they consider noise. If speech is too quiet, leave automatic microphone sensitivity on for the first test. If it sounds distorted in Teams, set Noise suppression to **Background noise only** and turn off Voice isolation for this virtual microphone.

The native Windows app must be used for routing, not the WSL Linux window. Conversation Mode never changes the Windows output device or the microphone selected by Edge; it only shows whether NEB is currently playing through CABLE Input.

## Changing headphones or speakers

NEB continues to send speech into **CABLE Input** even when Windows' normal output changes. To hear that speech through newly connected headphones or speakers, press `Win + R`, enter `mmsys.cpl`, then open **Recording → CABLE Output → Listen**. Leave **Listen to this device** enabled and choose the new device under **Playback through this device**.

The Console's **Volume di uscita** control changes only NEB's generated audio before it enters CABLE Input. Use it to avoid an overly quiet or loud virtual microphone signal; it does not change Windows, headset, or browser volume.
