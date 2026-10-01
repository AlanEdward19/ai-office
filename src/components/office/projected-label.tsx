"use client";
import {useEffect,useRef} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import {Vector3,Raycaster,type Group} from "three";
export type LabelLine = { text: string; kind: "kicker" | "title" | "meta" | "pill" | "brass" };
const projected=new Vector3();
export function ProjectedLabel({
  position,
  lines,
}: {
  position: [number, number, number];
  lines: { text: string; kind: "kicker" | "title" | "meta" | "pill" | "brass" }[];
}) {
  const anchor = useRef<Group>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const { camera, size, gl, scene } = useThree();
  const labelWorld = useRef(new Vector3());
  const labelDirection = useRef(new Vector3());
  const labelRay = useRef(new Raycaster());
  const linesKey = lines.map((line) => `${line.kind}:${line.text}`).join("|");

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    const content = lines;
    if (!parent) return;
    const node = document.createElement("div");
    node.style.position = "absolute";
    node.style.top = "0";
    node.style.left = "0";
    node.style.pointerEvents = "none";
    if (content.length > 1) {
      node.style.width = content.length > 3 ? "12rem" : "10rem";
      node.style.lineHeight = "1.5";
      node.style.display = "grid";
      node.style.gap = "3px";
      node.style.border = "1px solid #e4d5c4";
      node.style.borderRadius = "12px";
      node.style.background = "rgba(255, 250, 244, 0.95)";
      node.style.padding = "9px 12px";
      node.style.textAlign = "center";
      node.style.boxShadow = "0 8px 20px rgba(36, 28, 22, 0.16)";
    }
    for (const line of content) {
      const row = document.createElement("div");
      row.textContent = line.text;
      if (line.kind === "kicker" || line.kind === "meta") {
        row.style.fontSize = "10px";
        row.style.letterSpacing = line.kind === "kicker" ? "0.1em" : "normal";
        row.style.overflowWrap = "anywhere";
        row.style.textTransform = line.kind === "kicker" ? "uppercase" : "none";
        row.style.color = "#657575";
      } else if (line.kind === "title") {
        row.style.fontSize = "12px";
        row.style.fontWeight = "600";
        row.style.color = "#241c16";
        row.style.overflow = "hidden";
        row.style.textOverflow = "ellipsis";
        row.style.whiteSpace = "nowrap";
      } else if (line.kind === "brass") {
        row.style.borderRadius = "999px";
        row.style.background = "#1e3d34";
        row.style.color = "#f3e0b8";
        row.style.fontSize = "11px";
        row.style.fontWeight = "700";
        row.style.letterSpacing = "0.18em";
        row.style.textTransform = "uppercase";
        row.style.padding = "4px 12px";
      } else {
        row.style.maxWidth = "10rem";
        row.style.overflow = "hidden";
        row.style.textOverflow = "ellipsis";
        row.style.whiteSpace = "nowrap";
        row.style.borderRadius = "999px";
        row.style.background = "rgba(255, 250, 244, 0.95)";
        row.style.color = "#241c16";
        row.style.fontSize = "11px";
        row.style.fontWeight = "600";
        row.style.padding = "4px 12px";
        row.style.boxShadow = "0 6px 16px rgba(36, 28, 22, 0.12)";
      }
      node.appendChild(row);
    }
    parent.appendChild(node);
    card.current = node;
    return () => {
      card.current = null;
      node.remove();
    };
  }, [gl, lines, linesKey]);

  useFrame(() => {
    const node = card.current;
    const anchorGroup = anchor.current;
    if (!node || !anchorGroup) return;
    for(let parent=anchorGroup;parent;parent=parent.parent as Group){if(!parent.visible){node.style.display="none";return;}}
    anchorGroup.getWorldPosition(labelWorld.current);
    projected.copy(labelWorld.current).project(camera);
    const x = (projected.x * 0.5 + 0.5) * size.width;
    const y = (-projected.y * 0.5 + 0.5) * size.height;
    let visible =
      projected.z > -1 && projected.z < 1 && x > -80 && x < size.width + 80 && y > -40 && y < size.height + 40;
    if (visible) {
      labelDirection.current.copy(labelWorld.current).sub(camera.position);
      labelRay.current.far = Math.max(0, labelDirection.current.length() - 0.1);
      labelRay.current.set(camera.position, labelDirection.current.normalize());
      visible = labelRay.current.intersectObjects(scene.getObjectsByProperty("name", "office-wall"), false).length === 0;
    }
    node.style.display = visible ? "grid" : "none";
    node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  });

  return <group ref={anchor} position={position} />;
}
