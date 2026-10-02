/**
 * Voice for a direct call on the same Wi-Fi.
 * Echo cancellation has to run on the capture, and the codec stays mono
 * so the other machine does not play a second copy of the voice.
 */

export const LAN_VOICE_BITRATE = 48_000;

export function callAudioConstraints(): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
    sampleSize: 16,
  };
}

export function callVideoConstraints(): MediaTrackConstraints {
  return {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 24, max: 30 },
  };
}

export function callPeerConfig(): RTCConfiguration {
  return {
    iceServers: [],
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
}

/** Pins Opus to one channel with a steady LAN bitrate. Unknown audio is left untouched. */
export function preferLanVoice(sdp: string): string {
  const newline = sdp.includes("\r\n") ? "\r\n" : "\n";
  const lines = sdp.split(/\r\n|\n/);
  const map = lines.find((line) => line.startsWith("a=rtpmap:") && line.includes("opus/48000"));
  if (!map) return sdp;
  const payload = map.slice("a=rtpmap:".length).split(" ")[0];
  if (!payload) return sdp;
  const fmtp = `a=fmtp:${payload} minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=${LAN_VOICE_BITRATE};usedtx=0`;
  const next = lines.filter((line) => !line.startsWith(`a=fmtp:${payload}`));
  const index = next.findIndex((line) => line.startsWith(`a=rtpmap:${payload}`));
  if (index < 0) return sdp;
  next.splice(index + 1, 0, fmtp);
  const body = next.join(newline);
  return sdp.endsWith(newline) ? `${body}${newline}` : body;
}
