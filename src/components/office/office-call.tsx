"use client";

import { Mic, MicOff, Video, VideoOff, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { callInitiator, isPeerId, parseCallSignal, type CallPeer, type CallSignal } from "@/domain/call";
import { Button } from "@/components/ui/button";

type RemoteTile = {
  id: string;
  name: string;
  stream: MediaStream | null;
  audio: boolean;
  video: boolean;
};

type PeerLink = {
  pc: RTCPeerConnection;
  queued: RTCIceCandidateInit[];
};

/**
 * Direct WebRTC between whoever has this page open.
 * The dev server only forwards the signal while those pages stay connected.
 */
export function OfficeCall() {
  const [collapsed, setCollapsed] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [remotes, setRemotes] = useState<RemoteTile[]>([]);
  const [hint, setHint] = useState("Abrindo câmera e microfone…");
  const [ready, setReady] = useState(false);
  const audioRef = useRef(true);
  const videoRef = useRef(true);
  const selfRef = useRef("");
  const localStream = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const links = useRef(new Map<string, PeerLink>());

  useEffect(() => {
    const self = crypto.randomUUID();
    selfRef.current = self;
    let closed = false;
    let source: EventSource | null = null;
    const linksAtStart = links.current;

    const postSignal = async (to: string, signal: CallSignal) => {
      if (closed) return;
      await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: self, to, signal }),
      }).catch(() => undefined);
    };

    const announceMedia = () => {
      const signal: CallSignal = { type: "media", audio: audioRef.current, video: videoRef.current };
      for (const id of linksAtStart.keys()) void postSignal(id, signal);
    };

    const flushIce = async (link: PeerLink) => {
      if (!link.pc.remoteDescription) return;
      const queued = link.queued.splice(0);
      for (const candidate of queued) {
        await link.pc.addIceCandidate(candidate).catch(() => undefined);
      }
    };

    const createLink = (remoteId: string) => {
      const existing = linksAtStart.get(remoteId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: [] });
      const stream = localStream.current;
      if (stream) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }
      const link: PeerLink = { pc, queued: [] };
      linksAtStart.set(remoteId, link);
      pc.onicecandidate = (event) => {
        if (!event.candidate || closed) return;
        void postSignal(remoteId, {
          type: "ice",
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      };
      pc.ontrack = (event) => {
        if (closed) return;
        const [first] = event.streams;
        const streamForTile = first ?? new MediaStream([event.track]);
        setRemotes((current) => {
          const existing = current.find((tile) => tile.id === remoteId);
          if (!existing) {
            return [
              ...current,
              { id: remoteId, name: remoteId, stream: streamForTile, audio: true, video: true },
            ];
          }
          return current.map((tile) => (tile.id === remoteId ? { ...tile, stream: streamForTile } : tile));
        });
      };
      return link;
    };

    const makeOffer = async (remoteId: string) => {
      const link = linksAtStart.get(remoteId) ?? createLink(remoteId);
      try {
        const offer = await link.pc.createOffer();
        if (closed) return;
        await link.pc.setLocalDescription(offer);
      } catch {
        return;
      }
      const sdp = link.pc.localDescription?.sdp;
      if (!sdp) return;
      await postSignal(remoteId, { type: "offer", sdp });
    };

    const onRoster = (peers: CallPeer[]) => {
      const others = peers.filter((peer) => peer.id !== self);
      const live = new Set(others.map((peer) => peer.id));
      for (const [id, link] of linksAtStart) {
        if (live.has(id)) continue;
        link.pc.close();
        linksAtStart.delete(id);
      }
      setRemotes((current) =>
        others.map((peer) => {
          const existing = current.find((tile) => tile.id === peer.id);
          return (
            existing ?? { id: peer.id, name: peer.name, stream: null, audio: true, video: true }
          );
        }),
      );
      for (const peer of others) {
        if (linksAtStart.has(peer.id)) continue;
        createLink(peer.id);
        if (callInitiator(self, peer.id)) void makeOffer(peer.id);
      }
      announceMedia();
    };

    const onSignal = async (from: string, signal: CallSignal) => {
      if (signal.type === "media") {
        setRemotes((current) => {
          const existing = current.find((tile) => tile.id === from);
          if (!existing) {
            return [...current, { id: from, name: from, stream: null, audio: signal.audio, video: signal.video }];
          }
          return current.map((tile) =>
            tile.id === from ? { ...tile, audio: signal.audio, video: signal.video } : tile,
          );
        });
        return;
      }
      const link = linksAtStart.get(from) ?? createLink(from);
      try {
        if (signal.type === "offer") {
          await link.pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
          await flushIce(link);
          if (closed) return;
          const answer = await link.pc.createAnswer();
          await link.pc.setLocalDescription(answer);
          const sdp = link.pc.localDescription?.sdp;
          if (sdp) await postSignal(from, { type: "answer", sdp });
          return;
        }
        if (signal.type === "answer") {
          await link.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
          await flushIce(link);
          return;
        }
      } catch {
        return;
      }
      const candidate: RTCIceCandidateInit = {
        candidate: signal.candidate,
        sdpMid: signal.sdpMid,
        sdpMLineIndex: signal.sdpMLineIndex,
      };
      if (!link.pc.remoteDescription) {
        link.queued.push(candidate);
        return;
      }
      await link.pc.addIceCandidate(candidate).catch(() => undefined);
    };

    const stop = () => {
      closed = true;
      source?.close();
      source = null;
      for (const link of linksAtStart.values()) link.pc.close();
      linksAtStart.clear();
      localStream.current?.getTracks().forEach((track) => track.stop());
      localStream.current = null;
      if (localVideo.current) localVideo.current.srcObject = null;
    };

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setHint("Este navegador não abriu câmera nem microfone.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: true,
        });
        if (closed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStream.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
        setReady(true);
        setHint("");
      } catch {
        if (!closed) setHint("O navegador não liberou câmera e microfone.");
        return;
      }

      source = new EventSource(`/api/call?peer=${encodeURIComponent(self)}`);
      if (closed) {
        source.close();
        return;
      }
      source.addEventListener("roster", (event) => {
        const parsed = parsePayload((event as MessageEvent).data);
        if (!parsed || parsed.type !== "roster" || !Array.isArray(parsed.peers)) return;
        const peers = parsed.peers.flatMap((peer) => {
          if (!peer || typeof peer !== "object") return [];
          const record = peer as Record<string, unknown>;
          if (typeof record.id !== "string" || !isPeerId(record.id)) return [];
          const name = typeof record.name === "string" ? record.name : "";
          return name ? [{ id: record.id, name }] : [];
        });
        onRoster(peers);
      });
      source.addEventListener("signal", (event) => {
        const parsed = parsePayload((event as MessageEvent).data);
        if (!parsed || parsed.type !== "signal" || typeof parsed.from !== "string") return;
        const signal = parseCallSignal(parsed.signal);
        if (!signal) return;
        void onSignal(parsed.from, signal);
      });
      source.onerror = () => {
        if (!closed) setHint("A chamada reconecta enquanto a página estiver aberta.");
      };
    })();

    return () => {
      stop();
      setRemotes([]);
      setReady(false);
    };
  }, []);

  function toggleAudio() {
    const next = !audioRef.current;
    audioRef.current = next;
    setAudioOn(next);
    for (const track of localStream.current?.getAudioTracks() ?? []) track.enabled = next;
    const signal: CallSignal = { type: "media", audio: next, video: videoRef.current };
    for (const id of links.current.keys()) void sendMedia(selfRef.current, id, signal);
  }

  function toggleVideo() {
    const next = !videoRef.current;
    videoRef.current = next;
    setVideoOn(next);
    for (const track of localStream.current?.getVideoTracks() ?? []) track.enabled = next;
    const signal: CallSignal = { type: "media", audio: audioRef.current, video: next };
    for (const id of links.current.keys()) void sendMedia(selfRef.current, id, signal);
  }

  return (
    <section
      className={`call-panel absolute top-24 left-4 z-20 rounded-2xl border border-white/70 bg-white/85 text-slate-700 shadow-sm backdrop-blur ${collapsed ? "call-collapsed" : ""}`}
      data-testid="call-panel"
      data-audio={audioOn ? "on" : "off"}
      data-video={videoOn ? "on" : "off"}
    >
      <button type="button" className="call-heading" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? "Expandir chamada" : "Recolher chamada"}><span>Chamada direta</span>{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>
      <video
        ref={localVideo}
        data-testid="call-local"
        data-audio={audioOn ? "on" : "off"}
        data-video={videoOn ? "on" : "off"}
        autoPlay
        muted
        playsInline
        className="mt-1 h-16 w-full rounded-xl bg-black object-cover"
      />
      <p className="mt-2 px-1 text-xs leading-5 break-words">Você{videoOn ? "" : " · câmera desligada"}{audioOn ? "" : " · mudo"}</p>
      {remotes.length === 0 ? (
        <p className="mt-3 px-1 text-xs leading-5 text-[#5c5148]" data-testid="call-waiting">
          {ready ? "Só você nesta chamada." : hint || "Abrindo câmera e microfone…"}
        </p>
      ) : (
        remotes.map((tile) => <RemoteVideo key={tile.id} tile={tile} />)
      )}
      {hint && remotes.length > 0 ? <p className="mt-1 px-1 text-xs text-[#9c4221]">{hint}</p> : null}
      <div className="call-controls mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" data-testid="call-mic" aria-label={audioOn ? "Desligar microfone" : "Ligar microfone"} title={audioOn ? "Desligar microfone" : "Ligar microfone"} aria-pressed={audioOn} onClick={toggleAudio}>
          {audioOn ? <Mic size={15} /> : <MicOff size={15} />}
        </Button>
        <Button type="button" variant="outline" size="sm" data-testid="call-camera" aria-label={videoOn ? "Desligar câmera" : "Ligar câmera"} title={videoOn ? "Desligar câmera" : "Ligar câmera"} aria-pressed={videoOn} onClick={toggleVideo}>
          {videoOn ? <Video size={15} /> : <VideoOff size={15} />}
        </Button>
      </div>
    </section>
  );
}

function RemoteVideo({ tile }: { tile: RemoteTile }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.srcObject = tile.stream;
    return () => {
      if (node.srcObject === tile.stream) node.srcObject = null;
    };
  }, [tile.stream]);
  return (
    <div className="mt-2">
      <video
        ref={ref}
        data-testid="call-remote"
        data-name={tile.name}
        data-audio={tile.audio ? "on" : "off"}
        data-video={tile.video ? "on" : "off"}
        autoPlay
        muted={!tile.audio}
        playsInline
        className="h-16 w-full rounded-xl bg-black object-cover"
      />
      <p className="mt-2 px-1 text-xs leading-5 break-words">
        {tile.name}
        {tile.stream ? "" : " · ligando"}
        {tile.video ? "" : " · câmera desligada"}
        {tile.audio ? "" : " · mudo"}
      </p>
    </div>
  );
}

function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sendMedia(from: string, to: string, signal: CallSignal) {
  if (!from) return;
  void fetch("/api/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, signal }),
  }).catch(() => undefined);
}
